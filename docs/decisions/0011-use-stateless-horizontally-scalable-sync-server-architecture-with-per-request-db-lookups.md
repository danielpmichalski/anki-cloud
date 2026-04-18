# 11. Use stateless horizontally scalable sync-server architecture with per-request DB lookups

Date: 2026-04-18

## Status

Accepted

## Context

Multiple concurrent users need to sync their Anki collections via the custom sync server. The naive approach of a single instance with a global mutex (e.g., `Mutex<HashMap<String, User>>`) serializes all sync operations, creating a bottleneck that does not scale to thousands or millions of users.

We need an architecture that allows:
1. **Independent sync operations** — User A's sync should not block User B's sync
2. **Horizontal scalability** — Spin up additional sync-server instances as load increases
3. **Statelessness** — No per-instance affinity, so requests can be routed to any available instance
4. **User configuration injection** — Each user has different OAuth tokens and storage provider preferences

## Decision

Deploy multiple stateless sync-server instances behind a load balancer. Each instance:
- Holds **zero per-user state** (no user pools, no session caches)
- On every sync request, **queries a shared SQLite database** to fetch that user's config (storage provider, encrypted OAuth token, etc.) from the `storage_connections` table
- Constructs a `StorageBackend` via `StorageBackendFactory::create(provider, token)` on-demand
- Executes the sync independently (download collection, apply diff, upload collection)
- Returns to idle state, ready for the next request (any user, any instance)

A load balancer routes incoming requests to idle instances (or any instance — all are equivalent).

## Consequences

**Easier:**
- **Scales horizontally** — add instances without code changes; load balancer distributes requests
- **No inter-instance coordination** — each request is fully independent
- **Supports multiple backends** — `StorageBackendFactory` selects the right backend (GDrive, Dropbox, S3, etc.) per user, per request
- **Auto-scaling friendly** — instances can be added/removed dynamically based on CPU/queue depth

**More difficult:**
- **Shared state via SQLite** — must ensure DB is always accessible (single point of availability concern; mitigate with DB replication/failover)
- **Per-request DB overhead** — every sync incurs a lookup for user config; acceptable since lookups are fast (indexed on user_id)
- **No in-memory cache of user state** — if a user syncs frequently, we re-fetch their config each time; mitigated by Redis cache layer (future optimization)

**Risks:**
- **Database bottleneck** — if SQLite becomes slow, all instances are affected. Mitigation: monitor query times, index aggressively, migrate to PostgreSQL if needed at scale.
- **Lost sync state between instances** — sync sessions are ephemeral in memory within one instance. If the instance crashes mid-sync, we lose that state. Mitigation: persist sync session to Redis with TTL; recover on retry.
