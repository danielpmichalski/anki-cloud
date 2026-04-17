# 10. Rust sync server exposes internal sidecar HTTP API for collection mutations

Date: 2026-04-17

## Status

Accepted

## Context

The Hono REST API ([ADR-0008](./0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)) must
expose CRUD operations on decks, notes, and cards. That data lives in `collection.anki2` — a
SQLite file owned by the Rust sync server ([ADR-0003](./0003-fork-rust-ankitects-sync-server.md)).

The Rust sync server's public HTTP surface is exclusively the Anki client sync protocol
(`/sync/*`, `/msync/*`). These endpoints are stateful and multipart/form-data — not usable
by a REST API consumer.

Every write to `collection.anki2` must atomically increment the global USN in `col`, stamp
each modified row with the new USN and current `mtime`, and record deletions in `graves`.
Two independent writers without coordination produce USN collisions, which cause "collection
in inconsistent state" errors on the next Anki client sync.

Options evaluated:

1. **Internal sidecar** — Rust binary exposes a second HTTP listener on localhost; Hono calls it.
2. **Shared SQLite with Redis lock** — Hono writes directly to `collection.anki2`, coordinated via distributed lock.
3. **Hono uses `anki` Python package** — Python subprocess handles USN via rslib FFI.
4. **Hono pretends to be an Anki client** — speaks the sync protocol to push changes.
5. **Queue-based** — Hono enqueues mutations; Rust worker processes them.

Options 2–5 were rejected:

- **Option 2** requires reimplementing USN/mtime/graves management in TypeScript — duplicated logic, permanent correctness liability, GDrive race still possible on lock expiry.
- **Option 3** adds Python to the stack, loads full collection into memory, and introduces schema version drift risk between pip release and forked rslib.
- **Option 4** requires maintaining full local collection state and computing USN diffs in TypeScript to speak the exact sync protocol — enormous complexity for no gain.
- **Option 5** adds eventual-consistency semantics; REST callers (and LLM/MCP clients) expect synchronous confirmation.

## Decision

The forked Rust sync server binary runs two HTTP listeners:

```
:8080  (public)    → /sync/* /msync/*      Anki client sync protocol
:8081  (localhost) → /internal/v1/*        Collection CRUD, for Hono only
```

Hono never reads or writes `collection.anki2` directly. All collection mutations
(decks, notes, cards, media) are sent to the sidecar on `:8081`. The sidecar handlers
acquire the same per-user lock as sync handlers — CRUD and sync are mutually exclusive
per user. Rust remains the sole writer of `collection.anki2`.

The internal listener binds to `127.0.0.1` (or the Docker-internal network interface) and
is never published to the host. A shared secret header (`X-Internal-Token`) provides
defense-in-depth against misconfiguration.

### GDrive lifecycle for sidecar requests

```
1. Acquire per-user lock (same Mutex as sync handlers)
2. If collection not in local temp dir → CollectionStorage::fetch (download from GDrive)
3. Open collection via rslib
4. Execute operation (rslib handles USN / mtime / graves)
5. Close collection (rslib flushes WAL)
6. CollectionStorage::commit (upload to GDrive)
7. Release lock
8. Return JSON to Hono
```

### Sidecar routes (internal only)

```
GET    /internal/v1/decks
POST   /internal/v1/decks
GET    /internal/v1/decks/:id
DELETE /internal/v1/decks/:id

GET    /internal/v1/decks/:id/notes
POST   /internal/v1/decks/:id/notes
GET    /internal/v1/notes/:id
PUT    /internal/v1/notes/:id
DELETE /internal/v1/notes/:id

GET    /internal/v1/notes/search?q=<anki-search-syntax>
```

These routes are not public API — no versioning pressure, no OpenAPI spec needed.

## Consequences

**Easier:**

- Single write path — USN, mtime, graves exclusively managed by rslib; no duplication in TypeScript
- CRUD and sync are mutually exclusive per user via shared lock — no data races
- No GDrive race condition — one process owns the file lifecycle
- Hono stays purely TypeScript; no Rust knowledge required for REST API development
- Schema version handled entirely by rslib — no drift between REST API and sync server

**Harder:**

- Collection CRUD endpoints must be implemented in Rust (Axum routes calling rslib APIs)
- Every collection mutation from Hono incurs a localhost HTTP round-trip (sub-millisecond on same host)
- Two Axum listeners in one binary — slightly more complex startup and shutdown logic
- Sidecar port must be kept off the public network; deployment config must enforce this

## References

- Research: [docs/research/REST-API-over-rust-sync-server.md](../research/REST-API-over-rust-sync-server.md)
- [ADR-0003](./0003-fork-rust-ankitects-sync-server.md) — fork strategy and CollectionStorage trait
- [ADR-0007](./0007-mcp-server-wraps-rest-api-not-direct-db.md) — MCP wraps REST API
- [ADR-0008](./0008-use-hono-on-bun-for-rest-api-and-mcp-server.md) — Hono on Bun for REST API
