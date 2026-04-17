# REST API over Rust Sync Server — Research Notes

> Question: Is it feasible to build a REST API (CRUD on decks/notes/cards) that integrates
> with the forked Rust ankitects sync server? What is the right integration approach?
>
> Conclusion: Rust sync server exposes an internal sidecar HTTP API on localhost.
> The Hono REST API calls the sidecar — it never touches collection.anki2 directly.
> See [ADR-0010](../decisions/0010-rust-sync-server-exposes-internal-sidecar-for-collection-mutations.md).

---

## What the Sync Server Actually Exposes

The Rust sync server's public HTTP surface is **only the Anki client sync protocol**:

```
POST /sync/hostKey       ← credential exchange for session token
POST /sync/meta          ← collection metadata handshake
POST /sync/start         ← acquire exclusive user lock
POST /sync/applyChanges  ← Anki client pushes local changes
POST /sync/getChanges    ← Anki client pulls server changes
POST /sync/chunk         ← chunked transfer (large collections)
POST /sync/applyChunk
POST /sync/sanityCheck2
POST /sync/finish        ← commit, release lock
POST /msync/*            ← media sync
```

All `multipart/form-data`. All stateful and sequential. Designed for Anki
Desktop/Android/iOS — a REST API cannot piggyback on these in any useful way.
There is no existing endpoint a REST API can call to list decks or create a note.

---

## The Core Problem

The Hono REST API and the Rust sync server both need to read and write the same
`collection.anki2` SQLite file. Every write must:

1. Atomically increment the global USN in the `col` table
2. Stamp each modified row with the new USN and current `mtime` (epoch seconds)
3. Track deletions in the `graves` table

Two independent writers without coordination produce USN collisions, which cause
"collection in inconsistent state" errors on the next Anki client sync.
This is the non-negotiable constraint that drives the architecture choice.

---

## collection.anki2 Schema

```
notes     nid, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data
cards     cid, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, ...
decks     id, name, mtime, usn, lrnToday, revToday, newToday, conf, dyn, ...
col       id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags
revlog    id, cid, usn, ease, ivl, lastIvl, factor, time, type
graves    usn, oid, type   ← deletion tracking; 0=card, 1=note, 2=deck
```

**Schema evolution:** Anki 2.1.28+ moved deck/notetype data from JSON in `col` to
dedicated tables. 2.1.45+ uses Protobuf. 2.1.50+ introduces `collection.anki21b`
with zstd compression. The REST API must handle whichever version rslib writes —
the only safe way is to let rslib write it.

`collection.media.db` is a separate SQLite tracking filename-to-hash mappings.
Media files stored immutably by hash under `collection.media/`.

---

## Options Evaluated

### Option 1 — Internal sidecar HTTP API in Rust binary (chosen)

The forked Rust binary runs two HTTP listeners:

```
:8080  (public)    → /sync/* /msync/*         Anki client sync protocol
:8081  (localhost) → /internal/v1/*            Collection CRUD, called by Hono
```

Hono REST API never touches `collection.anki2`. All collection mutations go through
the sidecar. Rust owns USN, mtime, graves, GDrive download/upload, and the per-user lock.

```
LLM → MCP → Hono REST (:443) → Rust sidecar (:8081) → rslib → GDrive
                                       ↑
                    Anki Desktop → Rust sync (:8080)
```

**Why this is the only correct choice:**
- Single write path — USN/mtime/graves handled exclusively by rslib
- Per-user lock already exists for sync; sidecar acquires same lock → CRUD and sync are mutually exclusive
- No GDrive race — one process owns the file lifecycle
- Hono stays TypeScript ([ADR-0008](../decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)); no Rust CRUD surface exposed publicly
- Internal API is never public — no versioning pressure, no OpenAPI needed for it

**Trade-offs:**
- Rust CRUD implementation required (rslib has the collection APIs; wiring Axum routes is the work)
- Hono takes a localhost HTTP round-trip per collection mutation (sub-millisecond on same host)
- Single binary does more — but sync is per-user sequential anyway, so no scaling concern

---

### Option 2 — Both processes coordinate via Redis lock + raw SQLite (rejected)

Hono and Rust both download `collection.anki2` from GDrive, mutate, upload. Redis
distributed lock per user enforces one writer at a time.

**Why rejected:** Hono must reimplement USN management in TypeScript. Any bug permanently
desynchronizes the collection. GDrive upload race still possible on lock expiry. Most of
Option 1's operational complexity without Option 1's correctness guarantee.

---

### Option 3 — Hono uses `anki` Python package via subprocess (rejected)

`pip install anki` ships rslib via FFI. `anki.Collection(path)` handles USN/mtime.

**Why rejected:** Adds Python to the stack alongside Rust and TypeScript. Full collection
in memory. Schema version between pip release and forked rslib can diverge silently.
GDrive race still exists. Worst of all worlds.

---

### Option 4 — Hono "pretends to be an Anki client" (rejected)

Hono speaks the Anki sync protocol to the Rust server, pushing changes as if it were
Anki Desktop.

**Why rejected:** Requires maintaining full local collection state, computing USN diffs,
speaking the exact multipart/form-data protocol sequence. Enormously complex. The sync
protocol was not designed for this use case.

---

### Option 5 — Queue-based decoupling (rejected for now)

Hono enqueues mutations; Rust worker processes them via rslib.

**Why rejected for now:** Eventual-consistency semantics (HTTP call returns before commit).
Awkward for LLM/MCP use case where callers expect synchronous confirmation. Worth
revisiting if write volume warrants it.

---

## Sidecar Implementation Detail

### Dual Axum listeners

The sync server already uses Axum (the dominant Rust HTTP framework, tokio-based).
Adding a second listener on `127.0.0.1:8081` is straightforward:

```rust
// Existing public listener
let public_app = Router::new()
    .route("/sync/hostKey", post(host_key_handler))
    // ... other sync routes

// New internal sidecar listener
let internal_app = Router::new()
    .route("/internal/v1/decks", get(list_decks).post(create_deck))
    .route("/internal/v1/decks/:id", get(get_deck).delete(delete_deck))
    .route("/internal/v1/decks/:id/notes", get(list_notes).post(create_note))
    .route("/internal/v1/notes/:id", get(get_note).put(update_note).delete(delete_note))
    .route("/internal/v1/notes/search", get(search_notes))

tokio::join!(
    axum::serve(public_listener, public_app),
    axum::serve(internal_listener, internal_app),
);
```

### Lock and GDrive lifecycle for sidecar requests

```
1. Receive request on :8081
2. Acquire per-user lock (same Mutex/RwLock used by sync handlers)
3. If collection not in local temp dir → download from GDrive (CollectionStorage::fetch)
4. Open collection via rslib
5. Execute operation (rslib handles USN/mtime/graves automatically)
6. Close collection (rslib flushes WAL)
7. Upload modified file back to GDrive (CollectionStorage::commit)
8. Release lock
9. Return JSON response to Hono
```

Warm-cache optimization: if a sync recently finished, the temp dir may still exist.
Compare GDrive file etag before downloading to skip unnecessary round-trips.

### Auth on the sidecar

The internal listener binds to `127.0.0.1` only — not reachable outside the host.
In a container deployment, the Hono container and Rust container share a Docker network;
the internal port is not published to the host. A shared secret header
(`X-Internal-Token: <random>`) is set at startup as a defense-in-depth measure.

Public API key validation stays entirely in Hono — the sidecar receives only already-
authenticated requests.

### Media writes via sidecar

When a note references media:

1. Hono uploads the file to the sidecar as a multipart field
2. Rust computes the content hash, stores file in `collection.media/` on GDrive
3. Rust updates `collection.media.db` via rslib media APIs
4. File participates in the next `/msync/` cycle automatically

Never write media references into `notes.flds` without updating `collection.media.db`.

---

## Key Risks

| Risk | Severity | Mitigation |
|---|---|---|
| GDrive concurrent upload (CRUD + sync racing) | Critical | Shared per-user lock; CRUD and sync mutually exclusive |
| Sidecar port exposed outside container network | High | Bind to 127.0.0.1; no published port; shared secret header |
| Stale temp dir on crash | Medium | Validate GDrive etag on startup; clean orphaned temp dirs |
| Media orphaning (notes ref files not in media.db) | Medium | All media writes through rslib media APIs only |
| GDrive API rate limits under heavy CRUD | Low | Exponential backoff; batch small mutations |

---

## Existing Art

- **AnkiConnect** — HTTP plugin for Anki Desktop. Proxies through Anki's internal
  collection object. Requires Anki Desktop running. Confirms correct approach:
  never touch SQLite directly, always go through the collection object.
- **ankisync2** (PyPI, 2022) — Lightweight SQLite reader, no USN management. Read-only only.
- **genanki** (PyPI) — Creates `.apkg` from scratch. Cannot modify live collections.
- No open-source project successfully exposes a REST API over a live Anki collection
  without either (a) running Anki Desktop or (b) owning the collection object in Rust.

---

## Sources

- [`rslib/src/sync/` in ankitects/anki](https://github.com/ankitects/anki/tree/main/rslib/src/sync)
- [AnkiDroid Database Structure](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure)
- [AnkiConnect source](https://github.com/FooSoft/anki-connect)
- [ankitects/anki issue #2520](https://github.com/ankitects/anki/issues/2520) — community request for programmatic rslib API
- [Anki Manual — Sync Server](https://docs.ankiweb.net/sync-server.html)
- [docs/research/Anki-sync-protocol.md](./Anki-sync-protocol.md)
- [ADR-0003](../decisions/0003-fork-rust-ankitects-sync-server.md)
- [ADR-0008](../decisions/0008-use-hono-on-bun-for-rest-api-and-mcp-server.md)
- [ADR-0010](../decisions/0010-rust-sync-server-exposes-internal-sidecar-for-collection-mutations.md)
