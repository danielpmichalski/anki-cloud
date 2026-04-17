# 9. Use SQLite for persistent storage

Date: 2026-04-17

## Status

Accepted

## Context

The service requires persistent storage for a small, well-defined schema ([ADR-0004](./0004-use-oauth2-for-authentication-no-password-storage.md), [ADR-0006](./0006-use-google-drive-as-the-primary-storage-backend.md)):

```sql
users             -- identity, google_sub, email
storage_connections -- per-user OAuth tokens (encrypted), folder path
api_keys          -- hashed API keys, labels, revocation state
sync_sessions     -- last sync timestamp, client version, sync_key
```

Deck data, cards, and review history are **not** stored here — those live in user-owned cloud storage ([ADR-0002](./0002-use-user-owned-cloud-storage-for-deck-data.md)). The persistent DB footprint is tiny and write-heavy only at login and sync session boundaries.

The following options were evaluated:

| | SQLite | PostgreSQL | Turso (libSQL) |
|---|---|---|---|
| **Self-hostable** | ✅ file, zero-ops | ✅ extra container required | ⚠️ libSQL server or Turso cloud |
| **Docker footprint** | 0 extra services | ~300MB extra container | extra libSQL server |
| **Concurrent writes** | Single writer (WAL mode) | Full MVCC | Single writer (WAL) |
| **Data volume fit** | Perfect — tiny schema | Overkill | Fine |
| **Bun integration** | Native `bun:sqlite` | `pg` / `postgres.js` | `@libsql/client` |
| **Drizzle ORM** | ✅ | ✅ | ✅ |
| **Replication** | Manual / Litestream | Streaming built-in | Built-in |
| **Ops burden (self-hoster)** | None | Medium | Low–Medium |

**PostgreSQL** is the industry standard for concurrent writes and horizontal scale. Rejected because: the schema is 4 tiny tables, peak write load is login + sync session updates (not high-throughput OLTP), and it requires an extra container that self-hosters must operate for no practical benefit.

**Turso (libSQL)** offers SQLite-compatible API with built-in replication. Rejected because: self-hosting libSQL adds a service dependency that complicates `docker compose up`, and the replication benefit is irrelevant at MVP scale. May be revisited for the hosted platform tier.

**SQLite** in WAL mode handles concurrent reads cleanly and single-writer contention is negligible for this workload. Bun ships native `bun:sqlite` bindings — no extra driver, no extra container, no ops overhead. Drizzle ORM provides type-safe migrations and query building on top.

## Decision

Use **SQLite** (via **Drizzle ORM**) as the persistent database. Run in WAL mode. The database file is a Docker volume mount — self-hosters back it up like any file. Drizzle handles migrations; schema is the single source of truth for types.

## Consequences

**Easier:**
- Zero extra containers — self-hosters get one less service to operate
- `bun:sqlite` is native — no driver installation, near-zero overhead
- WAL mode allows concurrent reads without blocking writes
- Drizzle ORM provides compile-time type safety and migration tooling
- Simple backup: copy one file or use Litestream for continuous replication

**Harder:**
- Single writer — sustained high-concurrency writes would require moving to PostgreSQL (not anticipated at this scale)
- No built-in replication — hosted platform tier will need Litestream or a PostgreSQL migration
- This ADR may be superseded when the hosted platform requires multi-node deployment