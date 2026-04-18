# CLAUDE.md — Project Architecture & Decisions

> This file serves as the authoritative reference for AI assistants (and human contributors)
> working on this project. It captures all key product decisions, architecture choices, and
> rationale made during the initial design phase.

---

## 1. Project Vision

A **privacy-first, open-source Anki sync server** with a first-class REST API and MCP server,
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

OAuth2 only, no passwords. Google as sole provider for MVP.

### 3.2 Storage — [ADR-0002](docs/decisions/0002-use-user-owned-cloud-storage-for-deck-data.md) · [ADR-0006](docs/decisions/0006-use-google-drive-as-the-primary-storage-backend.md)

Deck data lives in user-owned cloud storage. Google Drive for MVP; Dropbox, S3, OneDrive on roadmap.
A `local` provider is also supported for testing/self-hosting without cloud storage.

### 3.3 Sync Protocol — [ADR-0003](docs/decisions/0003-fork-rust-ankitects-sync-server.md)

Fork of the Rust ankitects sync server with a cloud storage adapter layer.

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
│  │  Sync Server │  │  REST API    │  │   MCP Server     │  │
│  │  (Rust)      │  │ (Hono/Bun)   │  │   (wraps REST)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                 │                                │
│  ┌──────▼─────────────────▼──────────────────────────────┐ │
│  │              Auth & Storage Adapter Layer             │ │
│  │  Google OAuth (identity) + GDrive OAuth (storage)     │ │
│  └──────────────────────────┬────────────────────────────┘ │
│                             │                              │
│  ┌────────────────┐  ┌────────▼──────┐                     │
│  │  SQLite        │  │  Redis        │                     │
│  │  (user table,  │  │  (sessions,   │                     │
│  │   api keys,    │  │   cache,      │                     │
│  │   oauth tokens)│  │   rate limit) │                     │
│  └────────────────┘  └───────────────┘                     │
└──────────────────────────────┬─────────────────────────────┘
                               │ OAuth2 + Storage API
                               ▼
              ┌──────────────────────────────────┐
              │     User's Own Cloud Storage     │
              │  Google Drive / Dropbox / S3     │
              │  (deck data lives HERE, not us)  │
              └──────────────────────────────────┘
```

**Deployment:** The sync server runs as multiple stateless instances behind a load balancer.
Each instance queries a shared SQLite database for per-user config (OAuth tokens, storage provider) on every request,
enabling horizontal scaling via sharding. See [ADR-0011](docs/decisions/0011-use-stateless-horizontally-scalable-sync-server-architecture-with-per-request-db-lookups.md).

### 4.2 Data the Service Stores

**SQLite (persistent, tiny footprint):**

```sql
users
(
  id,
  google_sub,           -- Google's permanent user ID
  email,
  name,
  sync_password_hash,   -- bcrypt hash of per-user Anki sync password (nullable — null = not yet set up)
  created_at
)

storage_connections (
  id,
  user_id,
  provider,             -- 'gdrive' | 'dropbox' | 's3' | 'local'
  oauth_token,          -- encrypted at rest (AES-256-GCM)
  oauth_refresh_token,  -- encrypted at rest (AES-256-GCM); null for 'local' provider
  folder_path,
  connected_at
)

api_keys (
  id,
  user_id,
  key_hash,            -- bcrypt hash, never store plaintext
  label,
  last_used_at,
  created_at,
  revoked_at
)

users_sync_state (
  id,
  user_id,
  sync_key             -- hkey stored here for cross-instance re-hydration after restart
)
```

**What is NOT stored:** deck data, card content, review history, media files.
All of that lives in the user's GDrive.

**Redis (ephemeral):**

- Active sync session state (flushed to GDrive on completion)
- OAuth flow state (PKCE codes, state params — TTL: 10 minutes)
- Rate limiting counters
- API response cache (TTL: configurable)

### 4.3 Tech Stack

| Layer               | Technology                           | ADR                                                                                                                                                                |
|---------------------|--------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Sync server         | Rust (fork of ankitects sync server) | [ADR-0003](docs/decisions/0003-fork-rust-ankitects-sync-server.md)                                                                                                 |
| REST API + Auth     | TypeScript / Hono on Bun             | [ADR-0008](docs/decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)                                                                                     |
| MCP Server          | TypeScript / Hono on Bun             | [ADR-0007](docs/decisions/0007-mcp-server-wraps-rest-api-not-direct-db.md) · [ADR-0008](docs/decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)        |
| Persistent DB       | SQLite (via Drizzle ORM)             | [ADR-0009](docs/decisions/0009-use-sqlite-for-persistent-storage.md)                                                                                               |
| Cache / Sessions    | Redis                                | —                                                                                                                                                                  |
| Storage backends    | GDrive API / Dropbox API / S3 SDK    | [ADR-0002](docs/decisions/0002-use-user-owned-cloud-storage-for-deck-data.md) · [ADR-0006](docs/decisions/0006-use-google-drive-as-the-primary-storage-backend.md) |
| Containerization    | Docker + Docker Compose              | —                                                                                                                                                                  |
| CI/CD               | GitHub Actions                       | —                                                                                                                                                                  |
| Docs: API reference | Scalar (from OpenAPI spec)           | —                                                                                                                                                                  |
| Docs: Narrative     | Docusaurus                           | —                                                                                                                                                                  |

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

```
/
├── CLAUDE.md                  ← this file
├── README.md
├── docker-compose.yml         ← full local stack
├── docker-compose.dev.yml     ← dev overrides
│
├── anki-sync-server/          ← Rust workspace, upstream anki@25.09 rslib/
│   ├── Cargo.toml             ← workspace root (our only non-upstream file)
│   ├── Cargo.lock             ← copied from upstream
│   ├── README.md
│   ├── sync-storage-config/   ← our crate: DB lookups, token decrypt, bcrypt auth
│   │   └── src/lib.rs         ← fetch_storage_connection, verify_sync_credentials, store/lookup sync_key
│   ├── sync-storage-backends/ ← our crate: StorageBackend trait + GDrive/local impls
│   ├── sync-storage-api/      ← our crate: shared types
│   ├── ftl/                   ← verbatim copy of ankitects/anki ftl/ + submodules (anki_i18n build)
│   ├── proto/                 ← verbatim copy of ankitects/anki proto/ (anki_proto build)
│   └── rslib/                 ← verbatim copy of ankitects/anki rslib/
│       ├── src/sync/          ← sync protocol implementation
│       │   └── http_server/   ← ADR-0003 hook points (fetch/commit) go here
│       └── sync/              ← anki-sync-server binary (main.rs)
│
├── packages/
│   ├── api/                   ← TypeScript / Hono on Bun (REST API + auth)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           ← OAuth2 flows
│   │   │   │   ├── api-keys.ts
│   │   │   │   └── sync-credentials.ts ← GET/POST /v1/me/sync-password
│   │   │   └── middleware/           ← JWT session auth
│   │   └── package.json
│   ├── db/                    ← Drizzle ORM + SQLite schema (@anki-cloud/db)
│   │   ├── src/
│   │   │   ├── schema.ts             ← users, storage_connections, api_keys, users_sync_state
│   │   │   ├── migrations/           ← auto-generated SQL migrations
│   │   │   └── encrypt.ts            ← AES-256-GCM token encryption (matches sync-storage-config)
│   │   └── package.json
│   └── data/                  ← shared data types
│
├── web/                       ← Simple account management UI (Vite + React)
│   ├── src/
│   │   ├── App.tsx            ← StorageSection, SyncPasswordSection, ApiKeysSection
│   │   └── api.ts             ← typed REST API client
│   └── package.json
│
├── docs/                      ← Docusaurus narrative docs
│   ├── docs/
│   │   ├── getting-started.md
│   │   ├── self-hosting.md
│   │   ├── api-reference.md   ← links to Scalar
│   │   └── mcp-integration.md
│   └── docusaurus.config.js
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── publish-docs.yml
│       └── release.yml        ← release-please + conventional commits
│
└── scripts/
    ├── fork-anki-sync-server.zsh  ← copy rslib/ from ankitects/anki at a given tag
    └── generate-sdk.sh           ← openapi-generator invocation
```

---

## 5. Auth Flows

### 5.1 User Registration / Login (Google OAuth2)

```
1. User → clicks "Sign in with Google" on web UI
2. Service → redirects to Google OAuth2 with scopes: openid email profile
3. Google → user authenticates + consents
4. Google → redirects back with auth code
5. Service → exchanges code for id_token + access_token (server-side)
6. Service → decodes id_token, extracts sub (permanent Google user ID)
7. Service → upserts user record in SQLite (create if new, login if exists)
8. Service → issues session cookie / JWT to user
```

### 5.2 Google Drive Connection

```
1. Authenticated user → clicks "Connect Google Drive"
2. Service → redirects to Google OAuth2 with scopes: drive.file (NOT drive — minimal scope)
3. Google → user sees consent screen for Drive access
4. Google → redirects back with auth code
5. Service → exchanges for access_token + refresh_token
6. Service → stores refresh_token encrypted in SQLite (storage_connections table)
7. Service → creates /AnkiSync/ folder in user's Drive
```

### 5.3 Anki Client Sync

**Credentials:** Each user has a dedicated auto-generated sync password (separate from Google OAuth).
Generated/reset via `GET /v1/me/sync-password` and `POST /v1/me/sync-password/reset` — shown once in
web UI. Stored as bcrypt hash in `users.sync_password_hash`. Username = email address.

```
1. User → visits web UI, generates sync password (shown once), copies it
2. User → configures Anki client: custom sync URL + email + sync password (one-time setup)
3. Anki client → POST /sync/hostKey {username: email, password: sync_password}
4. Sync server → verifies bcrypt(password, users.sync_password_hash) — timing-safe
5. Sync server → derives hkey = SHA1(email:password), stores in users_sync_state.sync_key
6. Sync server → returns hkey to Anki client (used as session token for all subsequent requests)
7. Anki client → sends requests with hkey in anki-sync header
8. Sync server → looks up hkey in memory map; if missing (restart/failover), re-hydrates from DB
9. Sync server → fetches GDrive OAuth refresh_token from SQLite, exchanges for fresh access_token
10. Sync server → reads/writes collection from/to user's GDrive
11. Sync server → returns sync response to Anki client
```

### 5.4 LLM / MCP Auth

```
1. User → generates API key in web UI (one-time setup)
2. User → configures LLM MCP settings with: URL + API key
3. LLM → calls MCP tool (e.g. create_flashcard)
4. MCP server → validates API key (lookup in SQLite by hash)
5. MCP server → calls REST API with user context
6. REST API → applies change via storage adapter → writes to GDrive
```

---

## 6. API Design Principles

- **REST, not RPC** — standard HTTP verbs, resource-oriented URLs
- **OpenAPI 3.1** — spec is auto-generated, always in sync with code
- **Versioned** — all routes prefixed `/v1/`
- **Consistent error responses** — always `{ error: string, code: string, details?: object }`
- **Pagination** — cursor-based for all list endpoints
- **Rate limiting** — per API key, via Redis, 429 with `Retry-After` header
- **Idempotency** — POST endpoints accept `Idempotency-Key` header

### Key endpoints (illustrative)

```
GET    /v1/decks
POST   /v1/decks
GET    /v1/decks/{id}
DELETE /v1/decks/{id}

GET    /v1/decks/{id}/notes
POST   /v1/decks/{id}/notes
GET    /v1/notes/{id}
PUT    /v1/notes/{id}
DELETE /v1/notes/{id}

GET    /v1/cards/search?q=tag:python
POST   /v1/cards/bulk

GET    /v1/me
GET    /v1/me/api-keys
POST   /v1/me/api-keys
DELETE /v1/me/api-keys/{id}
```

---

## 7. MCP Tools

The MCP server exposes these tools to LLMs:

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
| `get_stats`         | Get study statistics for a deck            |

---

## 8. Build Order / Milestones

### Milestone 1 — M1: Proof of Concept

- [x] Fork ankitects Rust sync server (`anki-sync-server/`, upstream anki@25.09)
- [x] Implement GDrive storage adapter (read/write collection to Drive)
- [x] Wire GoogleDriveBackend into rslib sync server (hook points: fetch/commit)
- [x] Verify Anki Desktop can sync to custom server backed by GDrive
- [x] Basic Docker Compose setup

### Milestone 2 — M2: Auth + Account Management

**Architecture:** Multiple stateless sync-server instances, load-balanced. Each instance queries shared DB on-demand for per-user config. Auto-scale based on load.

- [x] SQLite schema + Drizzle ORM models (`storage_connections`, `users`, `users_sync_state`, `users_api_keys`) — `packages/db` (@anki-cloud/db)
- [x] Version the Rust sync server to match Anki's release tag (e.g. `25.09`) — it has a hard protocol dependency on a specific Anki version, so the version number is a meaningful compatibility signal. All other packages (REST API, MCP server, DB lib, web UI) use independent semver starting at `0.1.0`. A compatibility table in the README maps Anki versions to sync-server releases.
- [x] Google OAuth2 login flow (REST API)
- [x] GDrive OAuth2 connection flow (REST API)
- [x] REST API: multi-user account endpoints (`GET /v1/me`, `POST /v1/me/storage/connect`, etc.)
- [x] Simple web UI (account page, connect Drive, generate API keys)
- [x] Sync server: query shared DB for user's `storage_connections` on each request, inject into `StorageBackendFactory`
- [x] Sync server: DB-backed multi-user auth (`users.sync_password_hash`); no more `SYNC_USER*` env vars
- [x] Sync server: stateless re-hydration — hkey stored in `users_sync_state.sync_key`, re-hydrated from DB after restart/failover
- [x] Sync password web UI (generate, copy, reset in account page)
- [ ] Extract anki-sync-server to a separate repository (after the storage adapter interface is stabilized)

### Milestone 3 — M3: REST API

- [ ] Hono on Bun app with OpenAPI spec generation (Zod schemas)
- [ ] All deck/note/card endpoints
- [ ] API key auth middleware
- [ ] Scalar API docs
- [ ] openapi-generator SDK output (Python + JS)

### Milestone 4 — M4: MCP Server

- [ ] MCP server wrapping REST API
- [ ] All tools implemented
- [ ] Test with Claude Desktop
- [ ] MCP integration docs

### Milestone 5 — M5: Docs + Open Source Launch

- [ ] Docusaurus docs site
- [ ] Self-hosting guide (docker-compose up)
- [ ] API reference (Scalar, auto-deployed)
- [ ] Contributing guide
- [ ] GitHub release automation (release-please)

### Milestone 6 — M6: Additional Storage Backends

- [ ] Dropbox adapter
- [ ] S3-compatible adapter (Cloudflare R2, MinIO, AWS S3)
- [ ] OneDrive adapter

### Milestone 7 — M7: CLI (`anki-cloud-cli`)

- [ ] TypeScript CLI wrapping REST API (Bun single-binary build)
- [ ] Commands: `decks list/create`, `notes add/search/update/delete`, `auth login/logout`
- [ ] API key auth via `~/.config/anki-cloud/config.json` or env var
- [ ] npm publish + Homebrew formula
- [ ] Claude Code usage docs (bash tool integration)

### Milestone 8 — M8: Additional Auth Providers

Migrate to **Better Auth** (TS-native, self-hostable, Drizzle-compatible) to replace hand-rolled OAuth2. Replaces `routes/auth.ts` + session middleware. Manages `users` + sessions; app tables (`sync_password_hash`, `storage_connections`, `api_keys`) unchanged.

- [ ] Migrate Google OAuth2 to Better Auth
- [ ] Add GitHub OAuth2 (high-overlap audience)
- [ ] Add Microsoft OAuth2
- [ ] Add Facebook OAuth2
- [ ] Add GitLab OAuth2

### Milestone 9 — M9: DevOps

- [ ] CI/CD with GitHub Actions
- [ ] Docker image publishing
- [ ] GitHub release automation (release-please)

### Milestone 10 — M10: Miscellaneous

- [ ] Redis for sessions + rate limiting

---

## 9. Self-Hosting

The entire stack must be runnable with:

```bash
git clone https://github.com/your-org/anki-cloud
cd anki-cloud
cp .env.example .env   # fill in Google OAuth credentials
docker compose up
```

No external dependencies beyond Docker and a Google OAuth app (for auth).
Storage backend credentials are per-user (their own GDrive etc.).

---

## 10. Key Principles & Non-Negotiables

1. **We never store deck data.** User data lives in user-controlled storage. Always.
2. **We never store passwords for OAuth-authenticated users.** OAuth tokens only. Always scoped, always revocable. Exception: Anki sync uses a dedicated per-user sync password (bcrypt hash only, plaintext never
   persisted) because the Anki sync protocol does not support OAuth.
3. **Open source core (AGPLv3).** The sync server, REST API, and MCP server are all AGPLv3.
4. **Self-hostable.** Everything runs with `docker compose up`. No hidden dependencies.
5. **OpenAPI first.** The spec is the contract. SDKs and docs generate from it.
6. **Conventional commits.** Enables automated changelog and semantic versioning.
7. **Do not use "Anki" in the product name.** Registered trademark — legal risk.
8. **Prove the sync → GDrive adapter works before building anything else.**
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
- [ ] **Media files** — large audio/image files need special handling in GDrive (size limits, latency)
- [ ] **GDrive API rate limits** — need to understand quotas for sync-heavy users
- [ ] **AnkiMobile compatibility** — verify custom sync URL works with the iOS app

---

*Last updated: initial design session. Update this file as decisions evolve.*
