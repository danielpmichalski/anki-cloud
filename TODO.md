- implement comprehensive unit tests for api module
- we have e2e module and ./scripts/smoke-test.sh - not sure if we should keep both or combine them somehow
- make code more extensible following the Open-Closed principle; the below isn't extensible:
  - if (provider !== "google") {
  return c.json({error: "Provider not yet supported", code: "UNSUPPORTED_PROVIDER"}, 400);
  }
- extend REST API with note tags fetching;

---

## [ARCH] Add sync-platform-cloud — own the cloud sync server build

### Background

`anki-cloud-sync` is being refactored to expose a clean trait boundary (`sync-platform-api`)
with no platform knowledge. The cloud-specific impl — SQLite queries against our DB schema,
AES-256-GCM token decryption, bcrypt auth, OAuth token exchange — moves here as a new
Rust crate: `sync-platform-cloud`.

This repo will also take ownership of building the sync-server binary for the cloud
deployment target. The pre-built Docker image from `ghcr.io/danielpmichalski/anki-cloud-sync`
is replaced by a local Dockerfile that builds `sync-platform-cloud` + its deps.

This is a **Rust-in-TypeScript-monorepo** addition. The Rust crate lives at `sync-platform-cloud/`
in the repo root. It is not part of the npm workspaces; it has its own `Cargo.toml`.

### Context: DB schema

The Rust code queries these SQLite tables (actual names post–0003 migration):

| Table | Columns used |
|---|---|
| `user` | `id`, `email` |
| `user_sync_config` | `user_id`, `sync_password_hash` |
| `user_storage_connection` | `user_id`, `provider`, `oauth_refresh_token`, `folder_path` |
| `user_sync_state` | `user_id`, `sync_key` |

Token encryption format: `base64url(IV[12 bytes] || ciphertext || GCM-tag[16 bytes])`.
Must stay byte-for-byte compatible with `db/src/encrypt.ts`.
Key source: `TOKEN_ENCRYPTION_KEY` env var (32 bytes as 64 hex or 44 base64 chars).

### Tasks

**1. Create `sync-platform-cloud/` Rust crate**

Directory layout:
```
sync-platform-cloud/
  Cargo.toml
  src/
    lib.rs       ← CloudAuthProvider + CloudBackendResolver
    main.rs      ← binary entry: wires impls → starts SimpleServer
    db.rs        ← rusqlite helpers (open DB, queries)
    token.rs     ← AES-256-GCM decrypt (port from sync-storage-config/src/lib.rs)
    oauth.rs     ← HTTP refresh token exchange (port from sync-storage-config/src/lib.rs)
```

`Cargo.toml` dependencies:
```toml
[package]
name = "anki-sync-server-cloud"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "anki-sync-server"
path = "src/main.rs"

[dependencies]
sync-platform-api = { git = "https://github.com/danielpmichalski/anki-cloud-sync", tag = "<pinned>" }
sync-storage-backends = { git = "https://github.com/danielpmichalski/anki-cloud-sync", tag = "<pinned>" }
# anki-sync-server binary needs rslib too — pull same tag
anki = { git = "https://github.com/danielpmichalski/anki-cloud-sync", tag = "<pinned>" }
rusqlite = { version = "...", features = ["bundled"] }
bcrypt = "..."
aes-gcm = "..."
base64 = "..."
reqwest = { version = "...", features = ["json", "blocking"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1"
envy = "..."
serde = { version = "1", features = ["derive"] }
tracing = "..."
tracing-subscriber = "..."
```

**2. Implement `CloudAuthProvider`**

Port from `sync-storage-config/src/lib.rs`:

```rust
pub struct CloudAuthProvider { db_path: String }

impl AuthProvider for CloudAuthProvider {
    fn authenticate(&self, username: &str, password: &str) -> Result<(String, String)> {
        // 1. SELECT sync_password_hash FROM user_sync_config JOIN user WHERE email = username
        // 2. bcrypt::verify(password, hash) — timing-safe, always runs even for unknown users
        // 3. Derive hkey = hex(SHA1(format!("{username}:{password}")))
        // 4. UPSERT user_sync_state SET sync_key = hkey WHERE user_id = ...
        // 5. Return (hkey, username)
    }
    fn lookup_by_hkey(&self, hkey: &str) -> Result<String> {
        // SELECT email FROM user JOIN user_sync_state WHERE sync_key = hkey
    }
}
```

**3. Implement `CloudBackendResolver`**

Port from `sync-storage-config/src/lib.rs`:

```rust
pub struct CloudBackendResolver {
    db_path: String,
    enc_key: Vec<u8>,
    google_client_id: String,
    google_client_secret: String,
}

impl BackendResolver for CloudBackendResolver {
    fn resolve_for_user(&self, username: &str) -> Result<Box<dyn StorageBackend>> {
        // 1. SELECT provider, oauth_refresh_token, folder_path
        //    FROM user_storage_connection JOIN user WHERE email = username
        // 2. decrypt_token(oauth_refresh_token, &self.enc_key)  [AES-256-GCM]
        // 3. If provider != "local": exchange_refresh_token(decrypted) → access_token
        // 4. StorageBackendFactory::create(provider, access_token, folder_path)
    }
}
```

**4. Implement `src/main.rs`**

```rust
fn main() -> anyhow::Result<()> {
    tracing_subscriber::init();
    let db_path = std::env::var("DATABASE_URL")?;
    let auth = Arc::new(CloudAuthProvider::new(db_path.clone()));
    let resolver = Arc::new(CloudBackendResolver::from_env(db_path)?);
    let config = envy::prefixed("SYNC_").from_env::<SyncServerConfig>()?;
    let server = Arc::new(SimpleServer::new(&config.base_folder, auth, resolver)?);
    let (_addr, fut) = SimpleServer::make_server(config, server).await?;
    fut.await?;
    Ok(())
}
```

**5. Add `Dockerfile.sync`** to repo root:

```dockerfile
FROM rust:1.80-slim AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev protobuf-compiler
WORKDIR /build
COPY sync-platform-cloud/ .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /build/target/release/anki-sync-server /usr/local/bin/anki-sync-server
EXPOSE 8080
CMD ["anki-sync-server"]
```

Note: `cargo build` pulls anki-cloud-sync git deps at build time via Cargo.

**6. Update `docker-compose.yml`**

Change `sync-server` service from image pull to local build:
```yaml
sync-server:
  build:
    context: .
    dockerfile: Dockerfile.sync
  # Remove: image: ghcr.io/...
```

**7. Update CI (`.github/workflows/ci.yml`)**

Add step: `docker build -f Dockerfile.sync .` to verify the build on every PR.
No Rust lint/test step needed yet (covered by anki-cloud-sync's own CI).

**8. Pin the anki-cloud-sync tag**

Create `.sync-server-version` file at repo root containing the pinned tag (e.g. `v25.09-r7`).
Reference it in `Dockerfile.sync` and document the update procedure in CLAUDE.md.

**9. Update CLAUDE.md**

Add section: `sync-platform-cloud` crate, its DB table dependencies, the build process,
and the procedure for upgrading the pinned anki-cloud-sync tag.

### Acceptance criteria

- `docker build -f Dockerfile.sync .` succeeds
- `docker-compose up` starts the sync server using the locally built image
- Anki Desktop syncs successfully against the locally built server
- AES-256-GCM decrypt in Rust produces the same plaintext as `db/src/encrypt.ts` decrypt
  (write a round-trip test: encrypt in TypeScript → decrypt in Rust)
- `CloudAuthProvider::authenticate` rejects bad passwords (bcrypt mismatch)
- `CloudBackendResolver::resolve_for_user` returns a working `GoogleDriveBackend` for a
  user with a valid Google storage connection

### Sequencing note

Coordinate with `anki-cloud-sync` team:
1. This task can start in parallel with their rename/strip work.
2. `sync-storage-config` deletion in anki-cloud-sync should happen after this crate is working.
3. Update the pinned tag in `.sync-server-version` once they land the `sync-platform-api` rename.
