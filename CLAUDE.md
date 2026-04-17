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

| Component | Open Source | Notes |
|---|---|---|
| Anki Desktop | ✅ AGPLv3 | `ankitects/anki` on GitHub |
| AnkiDroid (Android) | ✅ AGPLv3 | Separate community project |
| anki-sync-server | ✅ AGPLv3 | Built into Anki Desktop since v2.1.57 |
| AnkiWeb (hosted sync) | ❌ Closed | Proprietary, run by Ankitects Pty Ltd |
| AnkiMobile (iOS) | ❌ Closed | Paid app, funds Anki development |

**Key insight:** The sync *protocol* and *server implementation* are open source. Only the
*hosted service* at ankiweb.net is closed. We run our own sync server — no dependency on
Ankitects ever shipping anything.

### Trademark note

**"Anki" is a registered trademark** of Ankitects Pty Ltd (USPTO #79340880, active May 2025).
Do NOT use "Anki" in the product name. Other apps have already received cease & desist letters.

---

## 3. Core Design Decisions

### 3.1 Authentication — Google OAuth2 (identity) — [ADR-0004](docs/decisions/0004-use-oauth2-for-authentication-no-password-storage.md) · [ADR-0006](docs/decisions/0006-use-google-as-the-sole-oauth-provider-mvp.md)

- Users register/login via Google OAuth2 only — no username/password stored
- Google's `sub` field (permanent unique user ID) is the primary user identifier
- DB stores: `google_id`, `email`, `name` — nothing sensitive

**Why:** Eliminates password storage liability entirely. Standard, trusted by users.

### 3.2 Storage — User's Own Cloud (GDrive first) — [ADR-0002](docs/decisions/0002-use-user-owned-cloud-storage-for-deck-data.md) · [ADR-0005](docs/decisions/0005-use-google-drive-as-the-primary-storage-backend.md)

- User authorizes the service to access their Google Drive via OAuth2
- Deck data is written directly to a folder in their Drive (e.g. `AnkiSync/`)
- The service stores **only** the OAuth token for their storage — no deck data ever touches our DB
- If the service shuts down tomorrow, user's data is intact in their Drive

**Supported backends (roadmap):**
1. Google Drive (MVP)
2. Dropbox
3. S3-compatible (power users / self-hosters)
4. OneDrive

**Why not store data ourselves:** Liability, GDPR complexity, storage costs, user trust.
The pitch is clean: *"Your cards live in your Google Drive. We just sync them."*

**Why not password caching:** Even "temporary" storage of plaintext credentials is a liability
the moment it touches the server. Cache TTL bugs, logs, memory dumps. Not worth it.
The only safe options are OAuth tokens (scoped, revocable) or nothing.

### 3.3 Sync Protocol — Anki-compatible sync server — [ADR-0003](docs/decisions/0003-fork-rust-ankitects-sync-server.md)

- Fork/extend Anki's own built-in sync server (Rust, open source since v2.1.57)
- Users change one setting: Tools → Preferences → Syncing → custom sync URL
- Works with Anki Desktop, AnkiDroid, and AnkiMobile unchanged
- The sync server reads/writes to the user's chosen storage backend (GDrive etc.)

**The sync server is stateless** regarding deck data — it proxies between the Anki client
protocol and the storage backend. A thin caching layer (Redis) holds data only during an
active sync session, then flushes to GDrive.

### 3.4 REST API — First-class, community-requested

The community has been requesting a public Anki API for years. This is it.

- Full CRUD on decks, notes, cards, tags
- Auth via API keys (generated in the web UI, tied to the user's OAuth identity)
- API keys are revocable and re-generable at any time
- OpenAPI spec is the single source of truth — everything else generates from it

### 3.5 MCP Server — LLM-native interface — [ADR-0007](docs/decisions/0007-mcp-server-wraps-rest-api-not-direct-db.md)

- Wraps the REST API as an MCP server
- Compatible with Claude (native) and any MCP-capable LLM client
- Exposes tools like: `create_flashcard`, `list_decks`, `add_to_deck`, `search_notes`
- Users configure their LLM with the MCP URL + API key — one-time setup

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Devices                          │
│  Anki Desktop / AnkiDroid / AnkiMobile / LLM UI            │
└────────────┬────────────────────────────┬───────────────────┘
             │ Anki Sync Protocol          │ MCP Protocol
             ▼                            ▼
┌────────────────────────────────────────────────────────────┐
│                     Your Service                            │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Sync Server  │  │  REST API    │  │   MCP Server     │ │
│  │  (Rust)       │  │  (FastAPI)   │  │   (wraps REST)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘ │
│         │                 │                                  │
│  ┌──────▼─────────────────▼──────────────────────────────┐ │
│  │              Auth & Storage Adapter Layer               │ │
│  │  Google OAuth (identity) + GDrive OAuth (storage)      │ │
│  └──────────────────────────┬────────────────────────────┘ │
│                              │                               │
│  ┌───────────────┐  ┌────────▼──────┐                      │
│  │  SQLite        │  │  Redis        │                      │
│  │  (user table,  │  │  (sessions,   │                      │
│  │   api keys,    │  │   cache,      │                      │
│  │   oauth tokens)│  │   rate limit) │                      │
│  └───────────────┘  └───────────────┘                      │
└──────────────────────────────┬─────────────────────────────┘
                               │ OAuth2 + Storage API
                               ▼
              ┌─────────────────────────────────┐
              │     User's Own Cloud Storage     │
              │  Google Drive / Dropbox / S3     │
              │  (deck data lives HERE, not us)  │
              └─────────────────────────────────┘
```

### 4.2 Data the Service Stores

**SQLite (persistent, tiny footprint):**

```sql
users (
  id,
  google_sub,          -- Google's permanent user ID
  email,
  name,
  created_at
)

storage_connections (
  id,
  user_id,
  provider,            -- 'gdrive' | 'dropbox' | 's3'
  oauth_token,         -- encrypted at rest
  oauth_refresh_token, -- encrypted at rest
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

sync_sessions (
  id,
  user_id,
  last_sync_at,
  client_version,
  sync_key             -- Anki's sync state token
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

| Layer | Technology | Rationale |
|---|---|---|
| Sync server | Rust (fork of ankitects sync server) | Battle-tested, correct protocol implementation |
| REST API + Auth | Python / FastAPI | Fast to build, OpenAPI-native, great ecosystem |
| MCP Server | Python | Wraps REST API, same language as API layer |
| Persistent DB | SQLite (via SQLAlchemy) | Zero infrastructure, trivially backed up, sufficient for scale |
| Cache / Sessions | Redis | Fast, TTL-native, standard for session management |
| Storage backends | GDrive API / Dropbox API / S3 SDK | User-owned storage |
| Containerization | Docker + Docker Compose | Local dev parity, easy self-hosting |
| CI/CD | GitHub Actions | Standard, free for open source |
| Docs: API reference | Scalar (from OpenAPI spec) | Better UX than Swagger UI |
| Docs: Narrative | Docusaurus | Open source, versioned, great DX |

### 4.4 OpenAPI as Single Source of Truth

```
Annotated FastAPI routes
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
├── sync-server/               ← Rust, fork of ankitects sync server
│   ├── src/
│   │   ├── main.rs
│   │   ├── protocol/          ← Anki sync protocol implementation
│   │   └── storage/           ← storage backend adapters
│   │       ├── gdrive.rs
│   │       ├── dropbox.rs
│   │       └── s3.rs
│   └── Cargo.toml
│
├── api/                       ← Python / FastAPI
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py            ← OAuth2 flows
│   │   ├── decks.py
│   │   ├── notes.py
│   │   ├── cards.py
│   │   └── api_keys.py
│   ├── models/                ← SQLAlchemy models
│   ├── services/              ← business logic
│   │   ├── storage/           ← storage backend clients
│   │   └── sync/
│   └── requirements.txt
│
├── mcp/                       ← MCP server (wraps API)
│   ├── server.py
│   ├── tools/
│   └── requirements.txt
│
├── web/                       ← Simple account management UI
│   ├── src/
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
    └── generate-sdk.sh        ← openapi-generator invocation
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

```
1. User → configures Anki client with custom sync URL (one-time setup)
2. Anki client → sends sync request with credentials to sync server
3. Sync server → authenticates user (Anki sync credentials map to our user account)
4. Sync server → fetches GDrive OAuth token from SQLite for this user
5. Sync server → reads current collection state from GDrive
6. Sync server → applies diff from Anki client
7. Sync server → writes updated collection back to GDrive
8. Sync server → returns sync response to Anki client
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

| Tool | Description |
|---|---|
| `list_decks` | List all decks with card counts |
| `get_deck` | Get deck details by name or ID |
| `create_deck` | Create a new deck |
| `create_note` | Add a flashcard to a deck |
| `create_notes_bulk` | Add multiple flashcards at once |
| `search_notes` | Search notes by query (Anki search syntax) |
| `update_note` | Edit an existing note |
| `delete_note` | Delete a note |
| `get_stats` | Get study statistics for a deck |

---

## 8. Build Order / Milestones

### Milestone 1 — Proof of Concept (de-risk the hard part)
- [ ] Fork ankitects Rust sync server
- [ ] Implement GDrive storage adapter (read/write collection to Drive)
- [ ] Verify Anki Desktop can sync to custom server backed by GDrive
- [ ] Basic Docker Compose setup

### Milestone 2 — Auth + Account Management
- [ ] Google OAuth2 login flow
- [ ] GDrive OAuth2 connection flow
- [ ] SQLite schema + SQLAlchemy models
- [ ] Simple web UI (account page, connect Drive, generate API keys)
- [ ] Redis for sessions + rate limiting

### Milestone 3 — REST API
- [ ] FastAPI app with OpenAPI spec generation
- [ ] All deck/note/card endpoints
- [ ] API key auth middleware
- [ ] Scalar API docs
- [ ] openapi-generator SDK output (Python + JS)

### Milestone 4 — MCP Server
- [ ] MCP server wrapping REST API
- [ ] All tools implemented
- [ ] Test with Claude Desktop
- [ ] MCP integration docs

### Milestone 5 — Docs + Open Source Launch
- [ ] Docusaurus docs site
- [ ] Self-hosting guide (docker-compose up)
- [ ] API reference (Scalar, auto-deployed)
- [ ] Contributing guide
- [ ] GitHub release automation (release-please)

### Milestone 6 — Additional Storage Backends
- [ ] Dropbox adapter
- [ ] S3-compatible adapter (Cloudflare R2, MinIO, AWS S3)
- [ ] OneDrive adapter

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
2. **We never store passwords.** OAuth tokens only. Always scoped, always revocable.
3. **Open source core (AGPLv3).** The sync server, REST API, and MCP server are all AGPLv3.
4. **Self-hostable.** Everything runs with `docker compose up`. No hidden dependencies.
5. **OpenAPI first.** The spec is the contract. SDKs and docs generate from it.
6. **Conventional commits.** Enables automated changelog and semantic versioning.
7. **Do not use "Anki" in the product name.** Registered trademark — legal risk.
8. **Prove the sync → GDrive adapter works before building anything else.**
   It's the riskiest assumption. Validate it first.

---

## 11. Architecture Decision Records (ADRs)

ADRs live in `docs/decisions/`. Use `adr-tools` to manage them.

### Conventions

- **Create** new ADRs with `adr new "<title>"` — auto-numbers and creates the file
- **Supersede** outdated ADRs with `adr new` + mark old one `Superseded by [ADR-NNNN]`; never edit accepted ADRs retroactively
- **Separate principles from implementations** — e.g. "use OAuth2" (principle, never superseded) vs "use Google as OAuth provider" (implementation, superseded when Microsoft added)
- **Link with markdown**, always: `[ADR-0002](./0002-use-user-owned-cloud-storage-for-deck-data.md)`
- **No forward references** — an ADR may only reference ADRs with lower numbers
- **CLAUDE.md section headings** link to their ADR(s) inline; keep those links up to date when ADRs are superseded

---

## 12. Open Questions (OSS-scoped)

- [ ] **Conflict resolution** — what happens when two devices sync simultaneously?
- [ ] **Media files** — large audio/image files need special handling in GDrive (size limits, latency)
- [ ] **GDrive API rate limits** — need to understand quotas for sync-heavy users
- [ ] **AnkiMobile compatibility** — verify custom sync URL works with the iOS app

---

*Last updated: initial design session. Update this file as decisions evolve.*
