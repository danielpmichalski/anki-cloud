# Anki Sync Protocol — Research Notes

> Sourced from: ankitects/anki source, community reverse-engineering, Anki manual.
> No formal spec exists — `rslib/src/sync/` is the authoritative implementation.

---

## HTTP Endpoints

All requests are `POST` with `multipart/form-data`. Data payloads sent in a field named `data` as JSON.

### Collection sync (`/sync/`)

| Endpoint | Purpose |
|---|---|
| `/sync/hostKey` | Auth — exchange username+password for session token |
| `/sync/meta` | Exchange collection metadata and USN |
| `/sync/start` | Begin sync, acquire exclusive user lock |
| `/sync/applyChanges` | Client pushes its local changes |
| `/sync/getChanges` | Client pulls server changes |
| `/sync/chunk` | Download large data in chunks |
| `/sync/applyChunk` | Upload large data in chunks |
| `/sync/sanityCheck2` | Verify collection integrity before commit |
| `/sync/finish` | Commit, release lock, update server USN |

### Media sync (`/msync/`)

Separate protocol — file-based, not transactional.

| Endpoint | Purpose |
|---|---|
| `/msync/getChanges` | List added/deleted media since last sync |
| `/msync/chunk` | Download media file by hash |
| `/msync/applyChunk` | Upload media file |
| `/msync/finish` | Finalize media sync state |

---

## Sync Flow Sequence

```
1. POST /sync/hostKey     u=<user> p=<pass>
   ← { key: "<hostKey>" }

2. POST /sync/meta        k=<hostKey> s=<syncKey> cv=<clientVersion>
   ← { usn: N, ls: <timestamp>, scm: <schema_version>, msg: "" }

3. POST /sync/start       k s
   ← { usn: N }

4. POST /sync/applyChanges  k s, data=<client changes JSON>
   ← { chunk: N, usn: N }

5. POST /sync/getChanges  k s
   ← { chunk: <data>, usn: N }

6. POST /sync/chunk / /sync/applyChunk   (if collection > threshold)
   ← chunked binary/JSON data

7. POST /sync/sanityCheck2  k s, data=<server state>
   ← { ok: true }

8. POST /sync/finish      k s
   ← { usn: <final> }

9. Media sync via /msync/* (automatic, post-collection)
```

---

## Authentication

- **hostKey** — server-issued session token from `/sync/hostKey`. Persists for session lifetime.
- **syncKey** — client-generated random token, fresh per sync. Prevents concurrent syncs (server rejects second sync with different key while first is active).
- **clientVersion** — format `"client,version,platform"` e.g. `"ankidroid,2.3,_"`.

Credentials sent in plaintext — HTTPS reverse proxy required in production.

---

## USN (Update Sequence Number)

Monotonically increasing integer. Every note, card, and deck carries a `usn` field.

| Value | Meaning |
|---|---|
| `-1` | Local changes not yet on server (needs push) |
| `0` | Never synced (full sync needed) |
| `< server USN` | Server has newer data (needs pull) |
| `= server USN` | In sync |

Diff calculation: client sends its current USN, server returns all changes since that USN.

---

## Conflict Resolution

| Change type | Resolution |
|---|---|
| Different notes/cards edited | Both preserved (merge) |
| Same field edited on both sides | Newer `modTime` (epoch seconds) wins |
| Deletions | Deletion always wins (via graves table) |
| Review history | Always append-only, both sides merged |
| Schema change (new field, removed template) | Non-mergeable — user must choose Upload or Download |

No "local winner"/"server winner" setting in the protocol. Structural conflicts require manual one-way sync resolution.

---

## Per-User Storage

Default base: `~/.syncserver` (override with `SYNC_BASE` env var).

```
<SYNC_BASE>/<username>/
  collection.anki2          ← main SQLite (notes, cards, decks, review log, USN)
  collection.anki2-wal      ← SQLite WAL
  collection.anki2-shm      ← SQLite shared memory
  collection.media.db       ← media metadata SQLite (filename → hash, sync state)
  collection.media/         ← actual media files, stored by filename hash
```

SQLite schema covers: `notes`, `cards`, `col` (metadata), `decks`, `revlog`, `graves`.

Collection size limits: 100 MB compressed / 250 MB uncompressed. Media files: < 100 MB each.

---

## Media Sync

File-based, not transactional. Files identified by hash — immutable once created.

- Additions on both sides: both kept
- Deletions: propagated
- Same file modified: newer `modTime` wins
- Always mergeable (no structural conflicts)

---

## Fork Strategy — Storage Abstraction

SQLite **must be local** during an active sync (random access, WAL, locks). GDrive I/O cannot happen in real-time during sync operations.

### Approach: lifecycle hooks

```
sync START  → download collection.anki2 + media.db from GDrive → local temp dir
[sync runs against local files normally]
sync FINISH → upload modified files back to GDrive → clean up temp
```

### Trait to introduce

```rust
trait CollectionStorage {
    async fn fetch(&self, user_id: &str, dest: &Path) -> Result<()>;
    async fn commit(&self, user_id: &str, src: &Path) -> Result<()>;
}
```

- `LocalStorage` — passthrough (for self-hosters, default behavior)
- `GDriveStorage` — download on fetch, upload on commit

### Hook points in the source

Both hooks live in `rslib/src/sync/http_server/` (likely `mod.rs`):

- **Download hook**: where collection file path is resolved per user (before `start`)
- **Upload hook**: where `finish` commits changes (after sanity check passes)

---

## Key Sources

- [Anki Manual — Sync Server](https://docs.ankiweb.net/sync-server.html)
- [Anki Manual — Syncing](https://docs.ankiweb.net/syncing.html)
- [Reverse-engineered protocol spec](https://github.com/Catchouli/learny/wiki/Anki-sync-protocol)
- [ankitects/anki source](https://github.com/ankitects/anki) — `rslib/src/sync/`
- [AnkiDroid database structure](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure)
- [ankicommunity/ankicommunity-sync-server](https://github.com/ankicommunity/ankicommunity-sync-server)
