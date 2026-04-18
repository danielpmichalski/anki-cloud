# 3. Fork Rust ankitects sync server

Date: 2026-04-17

## Status

Accepted

## Context

Anki clients (Desktop, AnkiDroid, AnkiMobile) use a proprietary sync protocol. To support these clients without modification, the service must speak that protocol correctly. Implementing it from scratch is high-risk —
the protocol is undocumented and has edge cases only discovered through real-world use.

Ankitects ships an open-source sync server (AGPLv3) written in Rust as part of the Anki Desktop codebase since v25.09. It implements the full sync protocol and is battle-tested against all official clients.

### Protocol overview

The sync server exposes two HTTP APIs accepting `POST multipart/form-data`:

- **`/sync/`** — collection sync (transactional, USN-based)
- **`/msync/`** — media sync (file-based, hash-identified)

Collection sync sequence: `hostKey → meta → start → applyChanges ↔ getChanges → [chunks] → sanityCheck2 → finish`

Authentication uses a server-issued `hostKey` session token plus a client-generated per-sync `syncKey` that prevents concurrent syncs on the same account.

Versioning is via **USN (Update Sequence Number)** — a monotonically increasing counter stored per note, card, and deck. The client sends its last-known USN; the server returns all changes since that point.

### Storage layout (upstream default)

The upstream server writes one directory per user under `SYNC_BASE`:

```
<SYNC_BASE>/<username>/
  collection.anki2        ← main SQLite (notes, cards, decks, review log)
  collection.media.db     ← media metadata SQLite
  collection.media/       ← media files stored by hash
```

SQLite must reside on local disk during an active sync — it requires random access, WAL, and file locking. GDrive I/O cannot substitute for local SQLite at operation time.

### Why not abstract storage at the SQLite level

The upstream codebase has no storage abstraction layer. Storage is tightly coupled to local SQLite in `rslib/src/sync/`. Introducing a virtual filesystem or remote SQLite would require invasive changes and break WAL
semantics.

## Decision

Fork the Rust sync server from `ankitects/anki`. Introduce a `CollectionStorage` trait with lifecycle hooks at sync session boundaries rather than replacing the SQLite layer:

```rust
trait CollectionStorage {
    async fn fetch(&self, user_id: &str, dest: &Path) -> Result<()>;
    async fn commit(&self, user_id: &str, src: &Path) -> Result<()>;
}
```

- **`fetch`** — called before `start`: downloads `collection.anki2` and `collection.media.db` from the user's cloud storage into a local temp directory.
- **`commit`** — called after `finish` (once sanity check passes): uploads the modified files back to cloud storage, then cleans up the temp directory.

The sync itself runs entirely against local SQLite as upstream intends. Redis holds active session state and maps `user_id → temp path` for the duration of the sync.

Both hook points live in `rslib/src/sync/http_server/` (the HTTP handler layer), keeping changes isolated from protocol logic.

Two implementations ship:

| Implementation  | Behavior                                                                               |
|-----------------|----------------------------------------------------------------------------------------|
| `LocalStorage`  | Passthrough — no-op fetch/commit, uses `SYNC_BASE` directly. Default for self-hosters. |
| `GDriveStorage` | Downloads from / uploads to the user's Google Drive folder on each sync session.       |

The fork stays as close to upstream as possible outside of the storage layer to ease future rebasing.

## Consequences

**Easier:**

- Protocol correctness guaranteed — used by millions of Anki users
- Compatible with Anki Desktop, AnkiDroid, and AnkiMobile unchanged
- Users change one setting (custom sync URL) — no client modifications
- AGPLv3 license compatible with our own
- Storage abstraction is shallow (two hook points) — minimises fork divergence

**Harder:**

- Tied to upstream Rust codebase — rebasing on upstream changes requires maintenance effort
- Rust expertise required for any sync server modifications
- GDrive download/upload adds latency at sync start and finish — must benchmark against real collections
- Must validate GDrive adapter round-trip works correctly before building anything else (highest-risk assumption)
- Concurrent sync prevention (syncKey) already handled by protocol; temp directory lifecycle must be managed carefully to avoid stale files on crash

## References

- Full protocol research: [docs/research/Anki-sync-protocol.md](../research/Anki-sync-protocol.md)
- Source authority: [`rslib/src/sync/` in `ankitects/anki`](https://github.com/ankitects/anki/tree/main/rslib/src/sync)
