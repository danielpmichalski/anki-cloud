# 12. Use SQLite for MVP with Turso migration path for multi-node horizontal scaling

Date: 2026-04-18

## Status

Accepted

## Context

[ADR-0011](./0011-use-stateless-horizontally-scalable-sync-server-architecture-with-per-request-db-lookups.md)
establishes that multiple stateless `anki-sync-server` instances share a single database for
per-user config lookups (OAuth tokens, storage provider) on every sync request. [ADR-0009](./0009-use-sqlite-for-persistent-storage.md)
chose SQLite as the database for MVP due to its zero-ops footprint and native Bun support.

The tension: SQLite is a **file**. Multiple instances on the same VM can share it via a
Docker volume (WAL mode handles concurrent reads; single-writer serializes writes). But
multiple instances on **different VMs** cannot share a single SQLite file over the network
without introducing a network filesystem (NFS), which adds latency, complexity, and a new
failure mode.

For MVP (single-node `docker compose up`), this is fine. For the hosted platform tier —
where auto-scaling spins up instances across multiple VMs — a shared SQLite file breaks
down. The question is when and how to cross that boundary.

The options evaluated:

| | SQLite (WAL, volume mount) | Turso / libSQL embedded replicas | PostgreSQL |
|---|---|---|---|
| **Self-hosting `docker compose up`** | ✅ zero extra services | ⚠️ `sqld` server container | ⚠️ extra container |
| **Multi-VM shared state** | ❌ file not shareable | ✅ built-in replication | ✅ full MVCC |
| **Driver change from SQLite** | — | Minimal (`@libsql/client`, same Drizzle dialect) | Breaking (dialect switch) |
| **Read latency (per sync request)** | Local file — sub-ms | Embedded replica — sub-ms locally | Network round-trip |
| **Ops burden (self-hoster)** | None | Low | Medium |
| **Migration effort** | — | Low — URL + driver swap | High — schema dialect, query compat |

**Turso (libSQL)** is a SQLite-compatible fork with built-in primary/replica replication.
Its **embedded replicas** feature is the key capability: each `anki-sync-server` instance
maintains a local SQLite copy that stays in sync with the primary. Reads are local (sub-ms),
writes go to the primary (network round-trip, acceptable since writes are infrequent — only
at login and sync session boundaries). The Drizzle ORM dialect is identical (`sqlite`);
the only code change is swapping `bun:sqlite` for `@libsql/client` and updating
`DATABASE_URL` to `libsql://...`.

**PostgreSQL** would require a dialect migration (different column types, different
migration files) and adds operational complexity for self-hosters. Rejected — the workload
does not justify it.

## Decision

**Start with SQLite** (as per [ADR-0009](./0009-use-sqlite-for-persistent-storage.md)) for
the MVP. When the hosted platform tier requires multi-VM horizontal scaling, migrate to
**Turso (libSQL) with embedded replicas**.

The migration path at that point:

1. Replace `bun:sqlite` driver with `@libsql/client`
2. Change Drizzle import from `drizzle-orm/bun-sqlite` → `drizzle-orm/libsql`
3. Update `DATABASE_URL` to `libsql://<db>.turso.io` (hosted) or `http://sqld:8080` (self-hosted `sqld` container)
4. Add `TURSO_AUTH_TOKEN` env var for hosted Turso; omit for self-hosted `sqld`
5. Re-run `drizzle-kit generate` to confirm no migration needed (dialect is identical)
6. Each `anki-sync-server` instance configures embedded replica sync on startup

Self-hosters who never need multi-VM scaling are unaffected — they continue using the
SQLite file path with a Docker volume.

## Consequences

**Easier:**

- MVP self-hosting stays zero-ops (no extra database container)
- Migration to Turso is low-friction: Drizzle dialect unchanged, one driver swap
- Embedded replicas eliminate per-request network latency for DB reads — scales to many
  `anki-sync-server` instances without the DB becoming a bottleneck
- Turso's free tier (500 DBs, 9 GB) covers the hosted platform until meaningful scale

**Harder:**

- Self-hosted multi-VM deployments require running `sqld` (Turso's open-source server)
  as an extra Docker service — slightly more complex than a plain file
- Turso embedded replicas introduce eventual consistency: a replica may briefly serve
  stale config after an OAuth token refresh. Mitigation: write-through invalidation or
  short sync interval (default 1s) is acceptable given sync frequency
- When Turso migration happens, `DATABASE_URL` format and env var conventions change;
  deployment documentation must be updated
