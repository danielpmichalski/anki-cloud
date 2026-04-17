# REST API over Rust Sync Server — Research Notes

> Question: Is it feasible to build a REST API (CRUD on decks/notes/cards) that integrates
> with the forked Rust ankitects sync server? What is the right integration approach?
>
> Conclusion: Extend the Rust sync server binary directly with HTTP CRUD endpoints.

---

## The Core Problem

The REST API and the Rust sync server both need to read and write the same
`collection.anki2` SQLite file. Every write must:

1. Atomically increment the global USN in `col` table
2. Stamp each modified row with the new USN and current `mtime` (epoch seconds)
3. Track deletions in the `graves` table

Two independent writers without coordination will produce USN collisions, which
causes "collection in inconsistent state" errors on the next Anki client sync.
This is the non-negotiable constraint that drives the architecture choice.

---

## collection.anki2 Schema

The SQLite database that the sync server reads and writes:

```
notes     nid, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data
cards     cid, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, ...
decks     id, name, mtime, usn, lrnToday, revToday, newToday, conf, dyn, ...
col       id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags
revlog    id, cid, usn, ease, ivl, lastIvl, factor, time, type
graves    usn, oid, type   ← deletion tracking; 0=card, 1=note, 2=deck
```

**Schema evolution note:** Anki 2.1.28+ moved deck/notetype data from JSON columns in
`col` to dedicated tables. 2.1.45+ uses Protobuf serialization. 2.1.50+ introduces
`collection.anki21b` with zstd compression. The REST API must handle the version the
sync server writes — coupling to rslib internals avoids any mismatch.

`collection.media.db` is a separate SQLite tracking filename-to-hash mappings.
Media files are stored immutably by hash under `collection.media/`.

---

## Options Evaluated

### Option A — Extend Rust sync server (chosen)

Add HTTP CRUD endpoints to the forked Rust binary. Handlers share the same user lock
and call rslib internals directly. No dual-write problem; no USN math outside Rust.

**Why this is the only correct choice for production:**
- Single write path — USN, mtime, graves all handled by rslib
- User lock already exists in sync protocol; CRUD handlers acquire same lock
- No GDrive race condition — one process owns the file lifecycle
- ADR-0003 already forks the server; this is a natural extension of that fork

**Trade-offs:**
- Rust expertise required for endpoint implementation
- Tighter coupling between sync and API in one binary
- Harder to scale independently (but sync is per-user sequential anyway)

---

### Option B — Official `anki` Python package (MVP shortcut, rejected)

`pip install anki` ships rslib via PyBridge FFI. `anki.Collection(path)` handles USN
and mtime automatically.

**Why rejected for production:**
- Full collection loaded into memory — problematic for 100 MB+ collections
- No concurrent access to the same `.anki2` file; GDrive race still exists
- Python process and Rust process both operating on GDrive files requires Redis
  coordination — most of Option A's complexity without Option A's correctness guarantee
- Schema version assumptions between pip package version and forked Rust version can diverge

**Could work for MVP** if the sync server and REST API are guaranteed never to run
concurrently per user (enforced via Redis lock covering the full GDrive lifecycle).

---

### Option C — Raw SQLite + manual USN management (rejected)

Direct SQLite writes with custom USN counter, mtime tracking, graves management.

**Why rejected:** Reimplements rslib sync logic in a second language. Every edge case
in the Rust implementation must be duplicated. Fragile on crash recovery, silent bugs
on partial writes, ongoing maintenance burden. 4–6 weeks to build, permanent liability.

---

### Option D — Queue-based decoupling (rejected for MVP)

REST API enqueues mutations; Rust worker processes them sequentially via rslib.

**Why rejected for now:** Adds eventual-consistency semantics (REST call returns before
mutation is committed). Complex for LLM/MCP use case where callers expect synchronous
confirmation. Worth revisiting at scale.

---

## Implementation Plan for Option A

### Where to add endpoints

Hook points identified in `rslib/src/sync/http_server/` (same module as sync handlers).
New routes live alongside existing `/sync/` and `/msync/` routes.

```
POST   /api/v1/decks
GET    /api/v1/decks
GET    /api/v1/decks/:id
DELETE /api/v1/decks/:id

POST   /api/v1/decks/:id/notes
GET    /api/v1/decks/:id/notes
GET    /api/v1/notes/:id
PUT    /api/v1/notes/:id
DELETE /api/v1/notes/:id

GET    /api/v1/notes/search?q=<anki-search-syntax>
```

### Locking strategy

The sync protocol already uses a per-user exclusive lock to prevent concurrent syncs
(enforced via `syncKey`). CRUD endpoints acquire the same lock. This means:

- CRUD and sync are mutually exclusive per user (correct behavior)
- Concurrent CRUD calls from the same user are serialized
- Lock held only during the operation, not during the GDrive upload

### GDrive lifecycle for CRUD requests

```
1. Acquire per-user lock (Redis or in-process Mutex)
2. If collection not in local temp dir → download from GDrive
3. Open collection via rslib
4. Execute CRUD operation (rslib handles USN/mtime/graves)
5. Close collection (rslib flushes WAL)
6. Upload modified collection.anki2 to GDrive
7. Release lock
```

A warm-cache optimization: if a sync session recently finished, the temp dir may still
exist. Check mtime against GDrive etag before downloading.

### Auth

CRUD endpoints authenticate via API key (same as REST API design in CLAUDE.md):

```
Authorization: Bearer <api-key>
```

The Rust binary validates the key against the SQLite `api_keys` table (bcrypt hash
comparison). This is the same SQLite used for user/session data, not the collection SQLite.

### Media writes

When a note references media files:

1. Upload file to GDrive `collection.media/` folder (by hash)
2. Update `collection.media.db` via rslib media sync APIs
3. Include in the next `/msync/` cycle automatically

Never write media references into `notes.flds` without updating `collection.media.db` —
doing so orphans the file and breaks media sync on all other devices.

---

## Key Risks

| Risk | Severity | Mitigation |
|---|---|---|
| GDrive concurrent upload (two users, same account, two requests) | Critical | Per-user Redis lock covering full download→mutate→upload |
| Schema version mismatch (pip anki vs forked rslib) | High | Single binary; no external Anki library |
| Stale temp dir on crash | Medium | Validate GDrive etag on startup; clean orphaned dirs |
| Media orphaning (note refs file not in media.db) | Medium | Route all media writes through rslib media APIs |
| GDrive API rate limits under heavy CRUD | Low | Exponential backoff; batch small mutations |

---

## Existing Art

- **AnkiConnect** — HTTP plugin for Anki Desktop. Proxies through Anki's internal
  collection object. Requires Anki Desktop running. Source confirms correct approach:
  never touch SQLite directly, always go through collection object.
- **ankisync2** (PyPI) — Lightweight SQLite reader. Last updated 2022. No USN management.
  Read-only use only.
- **genanki** (PyPI) — Creates `.apkg` files from scratch. Cannot modify live collections.
- No open-source project successfully exposes a REST API over a live Anki collection
  without either (a) running Anki Desktop or (b) owning the collection object in Rust.

---

## Sources

- [`rslib/src/sync/` in ankitects/anki](https://github.com/ankitects/anki/tree/main/rslib/src/sync)
- [AnkiDroid Database Structure](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure)
- [AnkiConnect source](https://github.com/FooSoft/anki-connect) — confirms collection-object approach
- [ankitects/anki issue #2520](https://github.com/ankitects/anki/issues/2520) — community request for programmatic API in rslib
- [Anki Manual — Sync Server](https://docs.ankiweb.net/sync-server.html)
- [docs/research/Anki-sync-protocol.md](./Anki-sync-protocol.md) — protocol deep-dive
- [ADR-0003](../decisions/0003-fork-rust-ankitects-sync-server.md) — fork strategy