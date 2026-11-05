# CLAUDE.md — Project Architecture & Decisions

> This file serves as the authoritative reference for AI assistants (and human contributors)
> working on this project. It captures all key product decisions, architecture choices, and
> rationale made during the initial design phase.

---

## 1. Project Vision

A **privacy-first Anki sync server** with a first-class REST API and MCP server,
enabling seamless LLM-to-Anki workflows. User deck data is stored in their own cloud storage
(Google Drive, Dropbox, etc.) — the service acts as stateless infrastructure, never holding
user data.

Self-hosters run everything with `docker compose up`. A separate hosted platform (closed-source,
open-core model) wraps this for users who want convenience over control.

### The core workflow this enables

```
User: "<discusses topic with LLM>; create flashcards from this discussion"
LLM:  "<shows proposed flashcards for review>"
User: "looks good, publish to my Anki"
LLM:  "<calls MCP tool> → cards appear in user's Anki instantly"
```

This must work from any LLM UI — desktop app, web UI, API client — without the user having
Anki open or doing anything manually.

---

## 2. The Problem Being Solved

### Why this doesn't exist yet

- **AnkiWeb** (the official sync service) is **closed source** and has no public API
- **AnkiWeb** has no OAuth2 — third-party services would need to store user passwords (unacceptable)
- **AnkiConnect** (the community API plugin) only works locally when Anki Desktop is open
- No existing solution bridges LLMs → Anki in a seamless, cloud-native, privacy-respecting way

### What is and isn't open source in the Anki ecosystem

| Component             | Open Source | Notes                                 |
|-----------------------|-------------|---------------------------------------|
| Anki Desktop          | ✅ AGPLv3    | `ankitects/anki` on GitHub            |
| AnkiDroid (Android)   | ✅ AGPLv3    | Separate community project            |
| anki-sync-server      | ✅ AGPLv3    | Built into Anki Desktop since v25.09  |
| AnkiWeb (hosted sync) | ❌ Closed    | Proprietary, run by Ankitects Pty Ltd |
| AnkiMobile (iOS)      | ❌ Closed    | Paid app, funds Anki development      |

**Key insight:** The sync *protocol* and *server implementation* are open source. Only the
*hosted service* at ankiweb.net is closed. We run our own sync server — no dependency on
Ankitects ever shipping anything.

### Trademark note

**"Anki" is a registered trademark** of Ankitects Pty Ltd (USPTO #79340880, active May 2025).
Do NOT use "Anki" in the product name. Other apps have already received cease & desist letters.

---

## 3. Core Design Decisions

### 3.1 Authentication — [ADR-0004](docs/decisions/0004-use-oauth2-for-authentication-no-password-storage.md) · [ADR-0005](docs/decisions/0005-use-google-as-the-sole-oauth-provider-mvp.md)

OAuth2 only, no passwords, handled by [Better Auth](https://better-auth.com) (mounted at `/v1/auth/*`).
Google and GitHub are the sign-in providers (GitHub is optional, enabled via env vars). Microsoft,
Facebook and GitLab are parked in the GitHub `Backlog` milestone. Note: ADR-0005 still says
"Google as the sole provider" — it predates the GitHub provider and should be superseded.

### 3.2 Storage — [ADR-0002](docs/decisions/0002-use-user-owned-cloud-storage-for-deck-data.md) · [ADR-0006](docs/decisions/0006-use-google-drive-as-the-primary-storage-backend.md)

Deck data lives in user-owned cloud storage. Google Drive is the only connectable provider today;
Dropbox, S3, OneDrive are in milestone M08. A `local` backend (filesystem under `SYNC_BASE`) exists in
the sync server for testing/standalone self-hosting without cloud storage.

### 3.3 Sync Protocol — [ADR-0003](docs/decisions/0003-fork-rust-ankitects-sync-server.md)

Fork of the Rust ankitects sync server (separate repo, `anki-cloud-sync`) exposing a platform-neutral
trait boundary. This repo supplies the cloud implementation as the `sync-platform-cloud` crate (§4.6).

### 3.4 REST API + MCP Server — [ADR-0007](docs/decisions/0007-mcp-server-wraps-rest-api-not-direct-db.md) · [ADR-0008](docs/decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)

Hono on Bun. Full CRUD API with OpenAPI spec auto-generated from Zod schemas. MCP server wraps the REST API — no direct DB access.

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Devices                         │
│  Anki Desktop / AnkiDroid / AnkiMobile / LLM UI             │
└────────────┬────────────────────────────┬───────────────────┘
             │ Anki Sync Protocol          │ MCP Protocol
             ▼                            ▼
┌────────────────────────────────────────────────────────────┐
│                     Your Service                           │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Sync Server │◄─┤  REST API    │◄─┤   MCP Server     │  │
│  │  (Rust,      │  │ (Hono/Bun,   │  │   (wraps REST)   │  │
│  │  :8080 sync, │  │  Better Auth)│  └──────────────────┘  │
│  │  :8081 side- │  └──────┬───────┘                        │
│  │  car)        │         │                                │
│  └──────┬───────┘         │                                │
│         │                 │                                │
│  ┌──────▼─────────────────▼──────────────────────────────┐ │
│  │                 Shared SQLite database                │ │
│  │ users/sessions (Better Auth), sync password hash,     │ │
│  │ encrypted storage tokens, API key hashes, sync keys   │ │
│  └───────────────────────────────────────────────────────┘ │
└──────────────────────────────┬─────────────────────────────┘
                               │ OAuth2 + Storage API
                               ▼
              ┌──────────────────────────────────┐
              │     User's Own Cloud Storage     │
              │  Google Drive / Dropbox / S3     │
              │  (deck data lives HERE, not us)  │
              └──────────────────────────────────┘
```

The REST API never touches collection files itself: collection mutations (decks, notes, cards) go
through the sync server's internal sidecar HTTP API on :8081 (`SIDECAR_URL` / `SIDECAR_TOKEN`,
see [ADR-0010](docs/decisions/0010-rust-sync-server-exposes-internal-sidecar-for-collection-mutations.md)).
Redis is **not** part of the stack today (see Redis note in §4.2).

**Deployment:** The sync server runs as multiple stateless instances behind a load balancer.
Each instance queries a shared SQLite database for per-user config (OAuth tokens, storage provider) on every request,
enabling horizontal scaling via sharding. See [ADR-0011](docs/decisions/0011-use-stateless-horizontally-scalable-sync-server-architecture-with-per-request-db-lookups.md).

### 4.2 Data the Service Stores

**SQLite (persistent, tiny footprint)** — schema in `db/src/schema.ts` (Drizzle), migrations in `db/src/migrations/`:

```sql
-- Owned by Better Auth (do not add app columns): user, session, account, verification
user (id, name, email, email_verified, image, created_at, updated_at)

-- App tables
user_sync_config (
  id,
  user_id,              -- unique FK -> user
  sync_password_hash    -- bcrypt hash of per-user Anki sync password (null = not yet set up)
)

user_storage_connection (
  id,
  user_id,
  provider,             -- 'google' | 'dropbox' | 's3' (only 'google' connectable today)
  oauth_token,          -- encrypted at rest (AES-256-GCM)
  oauth_refresh_token,  -- encrypted at rest (AES-256-GCM)
  folder_path,          -- default '/AnkiCloudSync'
  connected_at          -- unique (user_id, provider)
)

user_api_key (
  id,
  user_id,
  key_hash,             -- SHA-256 of the 'ak_...' key; plaintext never stored
  label,
  last_used_at,
  created_at,
  revoked_at
)

user_sync_state (
  id,
  user_id,              -- unique FK -> user
  last_sync_at,
  client_version,
  sync_key              -- hkey stored here for cross-instance re-hydration after restart
)
```

**What is NOT stored:** deck data, card content, review history, media files.
All of that lives in the user's Google Drive.

**Redis (not implemented):** earlier designs planned Redis for sessions, rate limiting and caching.
Sessions are handled by Better Auth in SQLite, and rate limiting is deferred ([ADR-0013](docs/decisions/0013-defer-pagination-rate-limiting-idempotency-and-bulk-endpoints-to-post-mvp.md)).
Redis is tracked in issue #9 (milestone M10) and is not part of `docker compose` today.

### 4.3 Tech Stack

| Layer               | Technology                              | ADR                                                                                                                                                                |
|---------------------|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Sync server         | Rust (fork of ankitects sync server)    | [ADR-0003](docs/decisions/0003-fork-rust-ankitects-sync-server.md)                                                                                                 |
| REST API + Auth     | TypeScript / Hono on Bun + Better Auth  | [ADR-0008](docs/decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)                                                                                     |
| MCP Server          | TypeScript / Hono on Bun                | [ADR-0007](docs/decisions/0007-mcp-server-wraps-rest-api-not-direct-db.md) · [ADR-0008](docs/decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)        |
| Persistent DB       | SQLite (via Drizzle ORM)                | [ADR-0009](docs/decisions/0009-use-sqlite-for-persistent-storage.md)                                                                                               |
| Cache / Sessions    | Better Auth sessions in SQLite (Redis planned, #9) | —                                                                                                                                                                |
| Storage backends    | Google Drive API / Dropbox API / S3 SDK | [ADR-0002](docs/decisions/0002-use-user-owned-cloud-storage-for-deck-data.md) · [ADR-0006](docs/decisions/0006-use-google-drive-as-the-primary-storage-backend.md) |
| Containerization    | Docker + Docker Compose                 | —                                                                                                                                                                  |
| CI/CD               | GitHub Actions                          | —                                                                                                                                                                  |
| Docs: API reference | Scalar (from OpenAPI spec)              | —                                                                                                                                                                  |
| Docs: Narrative     | Docusaurus                              | —                                                                                                                                                                  |

### 4.4 OpenAPI as Single Source of Truth

```
Hono routes + Zod schemas
        │
        ▼
  OpenAPI spec (auto-generated)
        │
   ┌────┴────────────────────────────────┐
   ▼              ▼              ▼        ▼
Scalar        SDK clients    Postman   MCP tool
(API docs)  (openapi-gen)  collection definitions
            Python, JS,
            Rust SDKs
```

Write the API once, everything else generates. Use Speakeasy or Stainless for
polished auto-generated SDK clients.

### 4.5 Repository Structure

The sync server (Anki protocol fork, trait boundary, storage backends) lives in a separate repository:
**[github.com/danielpmichalski/anki-cloud-sync](https://github.com/danielpmichalski/anki-cloud-sync)**
(AGPLv3, tagged releases like `v25.09-r8`). It has no knowledge of the REST API, MCP or web UI. Its
`sync-platform-api` crate defines `AuthProvider`, `BackendResolver` and `StorageBackend`; this repo
implements them in `sync-platform-cloud/`. Verbatim-upstream dirs there (`rslib/`, `ftl/`, `proto/`) are
never hand-edited. It is consumed here as Cargo git dependencies, built into a local Docker image via
`Dockerfile.sync`.

```
/
├── CLAUDE.md                  ← this file
├── README.md, CONTRIBUTING.md, CHANGELOG.md, TODO.md
├── Dockerfile.sync            ← builds sync-platform-cloud (Rust sync binary)
├── .sync-server-version       ← pinned anki-cloud-sync tag
├── docker-compose.yml         ← full stack: anki-sync-server (8080/8081) + api (3000) + mcp
├── docker-compose.cloud.yml / docker-compose.standalone.yml   ← variants
│
├── api/                       ← TypeScript / Hono on Bun (REST API + Better Auth)
│   └── src/
│       ├── index.ts, auth.ts, types.ts   ← auth.ts = Better Auth config (Google, GitHub)
│       ├── routes/            ← api-keys, sync-credentials, storage, decks, notes, cards, note-types
│       ├── middleware/auth.ts ← session cookie + `Authorization: Bearer ak_...` API key auth
│       └── lib/sidecar.ts     ← client for the sync server's internal sidecar (:8081)
│
├── db/                        ← Drizzle ORM + SQLite (@anki-cloud/db)
│   └── src/ schema.ts, migrations/, migrate.ts, encrypt.ts (AES-256-GCM, byte-compatible with Rust)
│
├── mcp/                       ← MCP server wrapping the REST API
│   └── src/ index.ts, client.ts, tools/ (decks.ts, notes.ts)
│
├── web/                       ← Account management UI (Vite + React; storage, sync password, API keys)
│
├── sync-platform-cloud/       ← Rust crate, own Cargo.toml (NOT an npm workspace) — see §4.6
│
├── e2e/                       ← end-to-end test suite (src/tests/01–04, helpers/)
├── scripts/                   ← setup.zsh, smoke-test.sh (curl-based API smoke test)
├── docs/                      ← SELF_HOSTING.md, mcp-integration.md, decisions/ (ADRs), research/, tests/
└── .github/workflows/         ← ci.yml, commitlint.yml, release.yml (release-please)
```

npm workspaces: `api`, `db`, `mcp` (see root `package.json`).

### 4.6 sync-platform-cloud (Rust sync binary)

`sync-platform-cloud/` is a Rust binary crate (`anki-sync-server`) at the repo root. Built by
`Dockerfile.sync`, it replaced the pre-built `ghcr.io/danielpmichalski/anki-cloud-sync` image in v2.0.0
(breaking change for self-hosters: the image is now compiled locally, ~10–20 min first build).

**Implements:**

- `CloudAuthProvider` — bcrypt-verifies against `user_sync_config.sync_password_hash`; upserts
  hkey into `user_sync_state.sync_key`
- `CloudBackendResolver` — reads `user_storage_connection`, AES-256-GCM decrypts the refresh
  token, exchanges it for a Google access token, returns a `GoogleDriveBackend`

**Required env vars** (beyond `SYNC_BASE` / `SYNC_INTERNAL_*`):

- `DATABASE_URL` — shared SQLite path, e.g. `file:/data/anki-cloud.db`
- `TOKEN_ENCRYPTION_KEY` — 32-byte AES-256 key (64 hex chars or 44 base64 chars)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for OAuth2 refresh token exchange

Token format: `base64url(IV[12] || ciphertext || GCM-tag[16])`; must stay byte-compatible with `db/src/encrypt.ts`.

**Pinned anki-cloud-sync tag:** `v25.09-r8` (see `.sync-server-version`). To upgrade:

1. Update `.sync-server-version`
2. Update the `tag =` value in `sync-platform-cloud/Cargo.toml` (all 4 git deps)
3. Run `docker build -f Dockerfile.sync .` locally and verify it succeeds (CI also builds it)
4. Update this file

---

## 5. Auth Flows

### 5.1 User Registration / Login (Google or GitHub OAuth2)

Handled by Better Auth (`api/src/auth.ts`, mounted at `/v1/auth/*`, tables `user`/`session`/`account`).

```
1. User → clicks "Sign in with Google" (or GitHub) on web UI
2. Better Auth → redirects to the provider's OAuth2 consent screen
3. Provider → redirects back to {BETTER_AUTH_URL}/v1/auth/callback/{provider} with auth code
4. Better Auth → exchanges code server-side, upserts user + account rows in SQLite
5. Better Auth → issues a session cookie (session stored in SQLite)
```

### 5.2 Google Drive Connection

```
1. Authenticated user → clicks "Connect Google Drive" (POST /v1/me/storage/connect)
2. Service → redirects to Google OAuth2 with scope drive.file (NOT drive — minimal scope)
3. Google → user consents, redirects to {FRONTEND_URL}/v1/me/storage/connect/google/callback
4. Service → exchanges code for access_token + refresh_token
5. Service → stores both encrypted (AES-256-GCM) in user_storage_connection
   (folder_path defaults to /AnkiCloudSync, changeable via PUT /v1/me/storage/{provider})
```

### 5.3 Anki Client Sync

**Credentials:** Each user has a dedicated auto-generated sync password (separate from OAuth login).
Generated/reset via `GET /v1/me/sync-password` and `POST /v1/me/sync-password/reset` — shown once in
web UI. Stored as bcrypt hash in `user_sync_config.sync_password_hash`. Username = email address.

```
1. User → visits web UI, generates sync password (shown once), copies it
2. User → configures Anki client: custom sync URL + email + sync password (one-time setup)
3. Anki client → POST /sync/hostKey {username: email, password: sync_password}
4. Sync server → verifies bcrypt(password, sync_password_hash) — timing-safe
5. Sync server → derives hkey = SHA1(email:password), stores in user_sync_state.sync_key
6. Sync server → returns hkey to Anki client (used as session token for all subsequent requests)
7. Anki client → sends requests with hkey in anki-sync header
8. Sync server → looks up hkey in memory map; if missing (restart/failover), re-hydrates from DB
9. Sync server → fetches Google Drive refresh_token from SQLite, exchanges for fresh access_token
10. Sync server → reads/writes collection from/to user's Google Drive
11. Sync server → returns sync response to Anki client
```

### 5.4 LLM / MCP Auth

```
1. User → generates API key (ak_...) in web UI (one-time setup)
2. User → configures LLM MCP settings with: MCP URL + API key (see docs/mcp-integration.md)
3. LLM → calls MCP tool (e.g. create_note)
4. MCP server → calls REST API with `Authorization: Bearer ak_...`
5. REST API → validates key (SHA-256 lookup in user_api_key, not revoked)
6. REST API → mutates the collection via the sync server sidecar (:8081) → written to Google Drive
```

---

## 6. API Design Principles — [ADR-0013](docs/decisions/0013-defer-pagination-rate-limiting-idempotency-and-bulk-endpoints-to-post-mvp.md)

- **REST, not RPC** — standard HTTP verbs, resource-oriented URLs
- **OpenAPI 3.1** — spec is auto-generated, always in sync with code
- **Versioned** — all routes prefixed `/v1/`
- **Consistent error responses** — always `{ error: string, code: string, details?: object }`
- **Pagination** — cursor-based for all list endpoints *(deferred post-MVP — see ADR-0013)*
- **Rate limiting** — per API key, via Redis, 429 with `Retry-After` header *(deferred post-MVP — see ADR-0013)*
- **Idempotency** — POST endpoints accept `Idempotency-Key` header *(deferred post-MVP — see ADR-0013)*

### Key endpoints (see `/openapi.json` / `/docs` for the authoritative list)

```
GET    /v1/decks
POST   /v1/decks
GET    /v1/decks/{id}
DELETE /v1/decks/{id}

GET    /v1/decks/{id}/notes
POST   /v1/decks/{id}/notes
GET    /v1/notes/search
GET    /v1/notes/{id}
PUT    /v1/notes/{id}
DELETE /v1/notes/{id}
GET    /v1/note-types, /v1/note-types/{id}

GET    /v1/cards/search?q=tag:python
POST   /v1/cards/bulk

GET    /v1/me
GET    /v1/me/api-keys, POST /v1/me/api-keys, DELETE /v1/me/api-keys/{id}
GET    /v1/me/sync-password, POST /v1/me/sync-password/reset
GET    /v1/me/storage, POST /v1/me/storage/connect, PUT|DELETE /v1/me/storage/{provider}
```

---

## 7. MCP Tools

The MCP server (`mcp/src/tools/`) exposes these tools to LLMs. `get_stats` (study statistics) is
not implemented yet.

| Tool                | Description                                |
|---------------------|--------------------------------------------|
| `list_decks`        | List all decks with card counts            |
| `get_deck`          | Get deck details by name or ID             |
| `create_deck`       | Create a new deck                          |
| `create_note`       | Add a flashcard to a deck                  |
| `create_notes_bulk` | Add multiple flashcards at once            |
| `search_notes`      | Search notes by query (Anki search syntax) |
| `update_note`       | Edit an existing note                      |
| `delete_note`       | Delete a note                              |

---

## 8. Milestones

Milestones and issue tracking live entirely on GitHub — that is the single source of truth.

- **Milestones:** https://github.com/danielpmichalski/anki-cloud/milestones
- **Issues:** https://github.com/danielpmichalski/anki-cloud/issues

M01–M06 are closed (v1.0.0 shipped 2026-04-20; v2.0.0 = sync-platform-cloud rearchitecture). Open: M07 (extra
auth providers — remaining ones moved to `Backlog`), M08 storage backends, M09 CLI, M10 misc.
The `Backlog` milestone holds ideas that are explicitly not planned for now.

---

## 9. Self-Hosting

The entire stack must be runnable with:

```bash
git clone https://github.com/your-org/anki-cloud
cd anki-cloud
cp .env.example .env   # fill in Google OAuth credentials, secrets, TOKEN_ENCRYPTION_KEY
docker compose up --build   # first run compiles the Rust sync server (~10–20 min)
```

No external dependencies beyond Docker and a Google OAuth app (for auth); GitHub OAuth is optional.
See README.md and docs/SELF_HOSTING.md.
Storage backend credentials are per-user (their own Google Drive etc.).

---

## 10. Key Principles & Non-Negotiables

1. **We never store deck data.** User data lives in user-controlled storage. Always.
2. **We never store passwords for OAuth-authenticated users.** OAuth tokens only. Always scoped, always revocable. Exception: Anki sync uses a dedicated per-user sync password (bcrypt hash only, plaintext never
   persisted) because the Anki sync protocol does not support OAuth.
3. **Dual-license strategy.** `anki-cloud-sync` (Rust sync server fork) is AGPLv3 — required by upstream Ankitects license. `anki-cloud` (REST API, MCP server, web UI) is **Elastic License 2.0 (ELv2)**: source-available,
   self-hosting permitted, offering it as a managed service requires a commercial license.
4. **Self-hostable.** Everything runs with `docker compose up`. No hidden dependencies.
5. **OpenAPI first.** The spec is the contract. SDKs and docs generate from it.
6. **Conventional commits.** Enables automated changelog and semantic versioning.
7. **Do not use "Anki" in the product name.** Registered trademark — legal risk.
8. **Prove the sync → Google Drive adapter works before building anything else.**
   It's the riskiest assumption. Validate it first.
9. **AI Agents: Never auto-commit code.** When work is complete, inform the user that changes are ready to commit. Let the user handle git commits themselves. This preserves user agency and prevents accidental commits.

---

## 11. Architecture Decision Records (ADRs)

ADRs live in `docs/decisions/`. Use `adr-tools` to manage them.

### Conventions

- **Create** new ADRs with `adr new "<title>"` — auto-numbers and creates the file
- **Supersede** outdated ADRs with `adr new` + mark old one `Superseded by [ADR-NNNN]`; never edit accepted ADRs retroactively
- **Separate principles from implementations** — e.g. "use OAuth2" (principle, never superseded) vs "use Google as OAuth provider" (implementation, superseded when Microsoft added)
- **Link with markdown**, always: `[ADR-0002](./0002-use-user-owned-cloud-storage-for-deck-data.md)`
- **No forward references** — an ADR may only reference ADRs with lower numbers, neither by link nor semantically (e.g. don't mention a concept that is only decided in a later ADR)
- **CLAUDE.md section headings** link to their ADR(s) inline; keep those links up to date when ADRs are superseded

---

## 12. Open Questions (OSS-scoped)

- [ ] **Conflict resolution** — what happens when two devices sync simultaneously?
- [ ] **Media files** — large audio/image files need special handling in Google Drive (size limits, latency)
- [ ] **Google Drive API rate limits** — need to understand quotas for sync-heavy users
- [ ] **AnkiMobile compatibility** — verify custom sync URL works with the iOS app

---

*Last updated: 2026-11-05 (post v2.0.0). Update this file as decisions evolve.*
