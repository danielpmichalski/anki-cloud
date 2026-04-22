# Remove SQLite from Sync Server — Option B Plan

## Problem

`anki-cloud-sync` (Rust) directly queries the shared SQLite DB via `rusqlite`, forcing it to carry
`aes-gcm`, `bcrypt`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID/SECRET`, and `DATABASE_URL`.
Both services share a Docker volume. The sync server can't be deployed independently.

## Two Operation Paths

### Path A — Sidecar (REST API → sync server :8081) — PUSH

REST API already has the user's storage config. It sends everything inline per request:

```
X-Internal-Token: <SIDECAR_TOKEN>
X-User-Email: user@example.com
X-Storage-Provider: google
X-Storage-Access-Token: ya29.xxx    ← fresh, already exchanged by REST API
X-Storage-Folder-Path: /AnkiCloudSync
```

Sync server uses these directly to construct a `StorageBackend`. No DB, no decryption, no token
exchange. Fully stateless and idempotent.

### Path B — Anki sync (Anki client → sync server :8080) — PULL

Anki clients connect directly; the REST API is not in the loop. Sync server calls 4 new internal
HTTP endpoints on the REST API:

| Endpoint                                     | Purpose                                                         |
|----------------------------------------------|-----------------------------------------------------------------|
| `POST /internal/v1/sync/verify-credentials`  | bcrypt-verify sync password; `{email, password}` → 200/401      |
| `GET  /internal/v1/sync/user-config?email=…` | decrypt + refresh OAuth → `{provider, accessToken, folderPath}` |
| `PUT  /internal/v1/sync/sync-key`            | upsert `user_sync_state.sync_key`; `{email, syncKey}` → 200     |
| `GET  /internal/v1/sync/sync-key/:hkey`      | reverse-lookup email → `{email}` or 404                         |

All 4 require `X-Internal-Token: <SYNC_CONFIG_API_TOKEN>`. The `user-config` endpoint handles
token decryption and Google token exchange internally — sync server only ever sees the fresh
`accessToken`, never the refresh token or encryption key.

---

## Changes

### `anki-cloud` (TypeScript REST API)

**New file: `api/src/routes/internal-sync.ts`**

4 pull endpoints (Path B). Auth via `X-Internal-Token` → `SYNC_CONFIG_API_TOKEN` env var.

`user-config` handler logic:

```ts
const conn = await db.query.userStorageConnection.findFirst(...)
const refreshToken = decrypt(conn.oauthRefreshToken)
const {access_token} = await exchangeGoogleToken(refreshToken)
return c.json({provider: conn.provider, accessToken: access_token, folderPath: conn.folderPath})
```

**`api/src/index.ts`** — mount the router:

```ts
import {internalSyncRouter} from "@/routes/internal-sync";

app.route("/internal/v1", internalSyncRouter);
```

**`api/src/lib/sidecar.ts`** — add storage config headers to every outbound sidecar call:

Before calling sidecar, REST API fetches the user's fresh access token and appends:

```ts
"X-Storage-Provider"
:
provider,
    "X-Storage-Access-Token"
:
accessToken,
    "X-Storage-Folder-Path"
:
folderPath,
```

New env var: `SYNC_CONFIG_API_TOKEN`

---

### `anki-cloud-sync` (Rust sync server)

**`sync-storage-config/src/lib.rs`** — full replacement

4 public functions → async `reqwest` HTTP calls to REST API. Shared client via `OnceLock<reqwest::Client>`.

```rust
pub async fn verify_sync_credentials(email: &str, password: &str) -> Result<()>
pub async fn fetch_user_config(email: &str) -> Result<(String, String, String)>  // (provider, accessToken, folderPath)
pub async fn store_sync_key(email: &str, hkey: &str) -> Result<()>
pub async fn lookup_user_by_sync_key(hkey: &str) -> Result<String>
```

Remove: `decrypt_token`, `load_enc_key`, `db_path`, `exchange_refresh_token`, `DUMMY_HASH`, AES-GCM/bcrypt/rusqlite code.

New env vars: `SYNC_CONFIG_API_URL`, `SYNC_CONFIG_API_TOKEN`
Removed: `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**`sync-storage-config/Cargo.toml`** — remove deps

Remove: `aes-gcm`, `bcrypt`, `rusqlite`, `data-encoding`, `hex`
Keep: `anyhow`, `reqwest`, `serde`, `serde_json`, `tokio`

**`sync-storage-server/src/handlers.rs`** — extract storage config from sidecar headers

Add alongside `user_email()`:

```rust
fn storage_provider(h: &HeaderMap) -> &str  // X-Storage-Provider
fn storage_token(h: &HeaderMap) -> &str     // X-Storage-Access-Token
fn storage_folder(h: &HeaderMap) -> &str    // X-Storage-Folder-Path
```

Pass config to resolver via `tokio::task_local!`:

```rust
tokio::task_local! {
    pub static SIDECAR_STORAGE: Option<(String, String, String)>;
}

// each handler:
SIDECAR_STORAGE.scope(Some((provider, token, folder)), async move {
with_user( & server, & email, | handle| { handle.with_col( | col | { ... }) })
}).await
```

**`sync-storage-server/src/resolver.rs`** — check task-local first, then REST API

```rust
impl BackendResolver for CloudBackendResolver {
    fn resolve_for_user(&self, username: &str) -> Result<Box<dyn StorageBackend>> {
        // Path A: sidecar provided config inline
        if let Ok(Some((provider, token, folder))) = SIDECAR_STORAGE.try_with(|c| c.clone()) {
            return StorageBackendFactory::create(&provider, &token, &folder);
        }
        // Path B: Anki sync — call REST API
        let (provider, access_token, folder_path) = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current()
                .block_on(sync_storage_config::fetch_user_config(username))
        })?;
        StorageBackendFactory::create(&provider, &access_token, &folder_path)
    }
}
```

**`sync-storage-server/src/auth.rs`** — `CloudAuthProvider` wraps async fns with `block_on`

```rust
fn authenticate(&self, username: &str, password: &str) -> Result<(String, String)> {
    tokio::task::block_in_place(|| {
        let rt = tokio::runtime::Handle::current();
        rt.block_on(sync_storage_config::verify_sync_credentials(username, password))?;
        let hkey = derive_hkey(&format!("{username}:{password}"));
        rt.block_on(sync_storage_config::store_sync_key(username, &hkey))?;
        Ok((hkey, username.to_string()))
    })
}

fn lookup_by_hkey(&self, hkey: &str) -> Result<String> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current()
            .block_on(sync_storage_config::lookup_user_by_sync_key(hkey))
    })
}
```

---

### `docker-compose.yml`

```yaml
anki-sync-server:
  environment:
    SYNC_BASE: /data
    SYNC_MODE: cloud                                # explicit
    SYNC_INTERNAL_PORT: 8081
    SYNC_INTERNAL_HOST: 0.0.0.0
    SYNC_INTERNAL_TOKEN: ${SIDECAR_TOKEN}
    SYNC_CONFIG_API_URL: http://api:3000            # new
    SYNC_CONFIG_API_TOKEN: ${SYNC_CONFIG_API_TOKEN} # new
    # removed: DATABASE_URL, TOKEN_ENCRYPTION_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  volumes:
    - sync-data:/data     # temp collections only — no DB file

api:
  environment:
    # ...existing...
    SYNC_CONFIG_API_TOKEN: ${SYNC_CONFIG_API_TOKEN} # new — validates sync-server calls
  volumes:
    - app-data:/data      # DB lives here exclusively
  depends_on:
    - anki-sync-server    # kept: needs sidecar

volumes:
  app-data:   # DB + API data
  sync-data:  # Anki temp collections (sync server only)
```

Add `SYNC_CONFIG_API_TOKEN` to `.env.example`.

---

## Files Summary

| File                                                  | Action                                    |
|-------------------------------------------------------|-------------------------------------------|
| `anki-cloud/api/src/routes/internal-sync.ts`          | Create                                    |
| `anki-cloud/api/src/index.ts`                         | Modify — mount router                     |
| `anki-cloud/api/src/lib/sidecar.ts`                   | Modify — add storage headers              |
| `anki-cloud/docker-compose.yml`                       | Modify — env vars + volumes               |
| `anki-cloud/.env.example`                             | Modify — add `SYNC_CONFIG_API_TOKEN`      |
| `anki-cloud-sync/sync-storage-config/src/lib.rs`      | Replace — HTTP functions                  |
| `anki-cloud-sync/sync-storage-config/Cargo.toml`      | Modify — remove 5 deps                    |
| `anki-cloud-sync/sync-storage-server/src/handlers.rs` | Modify — header extraction + task-local   |
| `anki-cloud-sync/sync-storage-server/src/resolver.rs` | Modify — task-local check + REST API pull |
| `anki-cloud-sync/sync-storage-server/src/auth.rs`     | Modify — block_on wrappers                |

## Verification

1. `cargo build` — zero `rusqlite`/`aes-gcm`/`bcrypt` references in sync server
2. `bun run typecheck` in `api/`
3. `docker compose up` — Anki client sync completes; `GET /v1/decks` works via sidecar
