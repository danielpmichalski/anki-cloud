# Google Drive API Connectivity for Anki-Cloud

Research on Google Drive API capabilities, OAuth2 token management, rate limits, and media handling for the MVP storage backend.

---

## 1. OAuth2 Token Management

Your system needs to handle the following token lifecycle:

| Aspect                 | Details                                                                                                                         |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| **Access Token TTL**   | 1 hour (3600 seconds) — must refresh before expiry                                                                              |
| **Refresh Token TTL**  | 6 months if unused; also invalidated if user changes password, revokes app access, or hits the 100-token limit per OAuth client |
| **Token Refresh Flow** | POST to `https://oauth2.googleapis.com/token` with refresh token → get new access token                                         |
| **Storage**            | Encrypt refresh tokens at rest in SQLite (your `storage_connections` table design is correct)                                   |

**Implementation detail:** Your REST API and sync server must check token expiry and refresh proactively before making Drive API calls. A token refresh cache (Redis) would avoid unnecessary round-trips.

### Refresh Token Invalidation Scenarios

Refresh tokens are automatically invalidated if:

- Not used for 6 months
- User explicitly revokes app access
- User changes their password (if Gmail scopes involved)
- User grants time-limited access that expires
- The app reaches the 100-token limit per OAuth client (oldest token is invalidated)

**Recovery:** Your system must detect invalid refresh tokens and re-initiate the OAuth flow to request new authorization.

---

## 2. Core Drive API Operations

Your `/AnkiSync/` folder will use these REST endpoints:

### Reading Collection Files

```
GET /drive/v3/files/{fileId}?alt=media
Range: bytes=0-1048575  ← partial downloads supported
```

**Key capabilities:**

- Stream file content directly
- Supports partial/range downloads for large files
- Verify download permissions via `capabilities.canDownload` field

### Writing Collection Files

**For small files (≤ 5 MB):**

```
POST /upload/drive/v3/files?uploadType=media
POST /upload/drive/v3/files/{fileId}?uploadType=media  ← overwrite
```

**For large files (> 5 MB) — Resumable Upload (recommended):**

```
POST /upload/drive/v3/files?uploadType=resumable
→ Returns session URI
→ Upload data in 256 KB chunks
→ Resume on network failure using Range header
```

**Key details:**

- Max file size: 5 TB per upload
- Upload sessions expire after 1 week inactivity
- Can retry failed uploads using pre-generated file IDs (prevents duplicates)

### Listing and Searching Files

```
GET /drive/v3/files?q=parents='{folderId}' and trashed=false
```

**Capabilities:**

- Complex metadata queries (MIME type, name, ownership, etc.)
- Pagination support
- Filter by folder, creation time, modification time

### Metadata and Versioning

```
GET /drive/v3/files/{fileId}?fields=webViewLink,createdTime,modifiedTime,size,md5Checksum
GET /drive/v3/files/{fileId}/revisions  ← version history
```

---

## 3. Drive.file Scope (Security & Permissions)

[ADR-0006](../decisions/0006-use-google-drive-as-the-primary-storage-backend.md) correctly chose `drive.file` scope. Here's why and what it means:

### What drive.file Allows

✅ **Permitted:**

- Create new files in user's Drive
- Modify files created by the app
- Read files the app created or the user opened with the app using Google Picker
- Users see minimal consent screen: *"This app can access files it creates"*
- Skip restricted scope verification (faster app launch, no security audit required)

❌ **Not Permitted:**

- Access pre-existing user files (unless user grants via Google Picker)
- View entire Drive hierarchy
- Access unrelated files or folders

### Why This is Correct for MVP

- **Security:** Limits blast radius if your OAuth credentials leak
- **User trust:** Minimal consent screen, clear intent
- **Faster deployment:** No restricted scope verification needed
- **Sufficient for MVP:** You create `/AnkiSync/` on first connect; all deck data lives there

---

## 4. Rate Limits & Quota Handling

Your sync server must handle these hard constraints:

| Limit             | Value                                          | Handling Strategy                                      |
|-------------------|------------------------------------------------|--------------------------------------------------------|
| **Query quota**   | 12,000 per 60 seconds (per-user + per-project) | Spread syncs with request coalescing; batch operations |
| **Write limit**   | 3 requests/second sustained per account        | Queue heavy syncs; batch collection updates            |
| **Daily upload**  | 750 GB/24h hard cap                            | Monitor media usage; document as limitation for MVP    |
| **Folder items**  | 500,000 files per folder                       | Not an issue (single collection file per `/AnkiSync/`) |
| **Per-file size** | 5 TB max                                       | Not an issue for Anki collections                      |

### Error Responses

- **403 Forbidden:** User rate limit exceeded → **exponential backoff required**
- **429 Too Many Requests:** Backend rate limit → **exponential backoff required**

### Exponential Backoff Algorithm

```
wait_time = min((2^n + random_jitter_ms), max_backoff)
where:
  n = attempt number (starts at 0)
  random_jitter_ms = random(0, 1000)
  max_backoff = 32-64 seconds
```

**Example:**

- Attempt 0: wait 0-1 sec
- Attempt 1: wait 1-3 sec
- Attempt 2: wait 2-5 sec
- Attempt 3: wait 4-9 sec
- Attempt 4: wait 8-17 sec
- Attempt 5: wait 16-32 sec
- Attempt 6+: wait 32-64 sec (capped)

---

## 5. Upload Strategy for Collection Files

### Collection File Characteristics

- Anki collections are SQLite files, typically **< 100 MB for most users**
- Some power users may have 500 MB+ (large media decks)
- Collections are monolithic (single `.anki2` file, not split)

### Upload Recommendations

| File Size | Strategy                   | Notes                                      |
|-----------|----------------------------|--------------------------------------------|
| ≤ 5 MB    | Simple or multipart upload | Single HTTP request, fast                  |
| > 5 MB    | Resumable upload           | Chunked, recoverable from network failures |

**MVP Recommendation:** Use resumable upload for **all writes** (regardless of size):

- Minimal overhead for small files
- Robust for large files
- Handles network interruptions gracefully
- Session expires after 1 week (acceptable for sync use case)

### Implementation Checklist

```
✅ Implement resumable upload for collection writes
✅ Split large files into 256 KB chunks
✅ Implement retry logic on 4xx errors (session expired)
✅ Use idempotency tokens to prevent duplicate writes
✅ Validate file checksums (MD5) after write
✅ Log all upload errors for debugging
```

---

## 6. Media File Handling (Future Consideration)

[ADR-0002](../decisions/0002-use-user-owned-cloud-storage-for-deck-data.md) explicitly flags media handling as a known challenge.

### Current Constraints

- **Individual file size:** Up to 5 TB (not a practical issue)
- **Quota problem:** 750 GB/day daily limit
    - User with 10 GB of audio cards syncing frequently = quota exhaustion after ~75 days
    - Each media file = separate API call (latency + quota cost)
- **Latency:** Media files must be downloaded sequentially or in parallel (N+1 API calls per sync)

### MVP Decision

**Store only the `.anki2` collection file — omit media files from MVP.**

**Rationale:**

- 90% of Anki users have text-only decks
- Avoids 750 GB/day quota issues
- Simplifies sync protocol
- Media files can be handled in Milestone 6 with a dedicated strategy

**Documentation:**

- Add to README: "Media files are not synced in MVP. Workaround: manually manage media in AnkiWeb or use Anki's built-in export."
- Plan for Milestone 6: Consider CDN + Drive, or switch media to Dropbox (higher quotas)

---

## 7. GDrive Folder Structure for /AnkiSync/

Based on the MVP design:

```
/AnkiSync/
├── collection.anki2       ← Main collection file (the deck database)
├── backups/
│   ├── collection.anki2.backup.20260418.153000
│   └── collection.anki2.backup.20260418.143000
└── metadata.json          ← Optional: last sync time, version, etc.
```

**Folder creation:**

- Create `/AnkiSync/` on first GDrive connection
- Use `mimeType=application/vnd.google-apps.folder` in Drive API
- Set folder metadata (created by app for easy identification)

**File management:**

- **collection.anki2:** Overwrite on each sync (no versioning in Drive itself)
- **backups/:** Keep last 5-10 versions (for user recovery)
- **metadata.json:** Track last sync timestamp, protocol version

---

## 8. Error Resilience Checklist

Build these into your storage adapter layer:

```
✅ Token refresh on 401 Unauthorized
   └─ Proactively refresh tokens before expiry (1-hour TTL)
   └─ Handle refresh token invalidation → re-trigger OAuth flow

✅ Exponential backoff on 403/429 errors
   └─ Implement algorithm from section 4

✅ Idempotent writes
   └─ Pre-generate file IDs to prevent duplicates on retry

✅ Handle sync session timeouts
   └─ Resumable upload sessions expire after 1 week
   └─ Detect 4xx errors and restart upload

✅ Graceful degradation
   └─ If Drive is slow: cache collection locally, warn user
   └─ If quota exceeded: block new syncs, show quota status

✅ Observability
   └─ Log all rate limit errors (early warning for quota exhaustion)
   └─ Monitor token refresh failures
   └─ Track sync latency per user
```

---

## 9. Implementation Priority

### Must-Have for MVP

1. OAuth2 token refresh (proactive + reactive)
2. Resumable upload for collection files
3. Exponential backoff on rate limit errors
4. Create `/AnkiSync/` folder on first connect
5. Read/write single collection.anki2 file

### Nice-to-Have for MVP

1. Backup rotation (keep last 5 versions)
2. File checksums (MD5 validation post-write)
3. Quota monitoring (alert on approaching 750 GB/day)

### Defer to Later Milestones

1. Media file sync
2. Version history via Drive revisions
3. Dropbox/S3/OneDrive adapters
4. Conflict resolution for simultaneous syncs

---

## 10. Testing Strategy

### Unit Tests

- Token refresh logic (mock token expiry)
- Exponential backoff calculation
- File upload logic (mock 5 MB boundary)

### Integration Tests (requires Drive sandbox/test account)

- End-to-end OAuth flow
- Create `/AnkiSync/` folder
- Write and read collection.anki2
- Simulate 403/429 errors → verify backoff
- Simulate token expiry → verify refresh

### Load/Quota Tests

- Simulate 12,000 requests per 60s → expect 403 responses
- Simulate resumable upload interruption → verify recovery
- Measure sync latency for various collection sizes (1 MB, 10 MB, 100 MB)

---

## References

- [Google Drive API Limits & Quotas](https://developers.google.com/workspace/drive/api/guides/limits)
- [Google Drive File Upload Methods](https://developers.google.com/drive/api/guides/manage-uploads)
- [Google Drive File Downloads](https://developers.google.com/drive/api/guides/manage-downloads)
- [Google Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [OAuth2 Token Refresh](https://developers.google.com/identity/protocols/oauth2)
- [ADR-0002: User-Owned Cloud Storage](../decisions/0002-use-user-owned-cloud-storage-for-deck-data.md)
- [ADR-0006: Google Drive as Primary Backend](../decisions/0006-use-google-drive-as-the-primary-storage-backend.md)

