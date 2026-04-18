# E2E Testing: Google Drive Sync Integration

This guide walks through end-to-end testing of the GoogleDriveBackend storage adapter wired into the rslib sync server.

## What You're Testing

- ✅ Sync server can fetch collection from Google Drive before sync
- ✅ Sync server can commit collection to Google Drive after sync
- ✅ Anki Desktop can sync with a custom server backed by GDrive
- ✅ Collection file appears and persists in user's GDrive `/AnkiSync/` folder
- ✅ Incremental syncs work correctly

## Prerequisites

### 1. Google Drive OAuth Access Token

You need a valid Google Drive API access token. Options:

**Option A: Use existing token (if you have one)**

- From a prior GDrive OAuth flow
- Must have `drive.file` scope
- Must not be expired (1 hour TTL)

**Option B: Get a fresh token via OAuth flow**

- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project (or use existing)
- Enable Google Drive API
- Create OAuth 2.0 credential (Desktop app)
- Use a tool like `curl` + Google's token endpoint, or run the `anki-cloud` REST API (M2) which handles this flow
- Extract the access token from the response

**Option C: Use a refresh token to get access token**

- If you have a refresh token from a prior flow:
  ```bash
  curl -X POST https://oauth2.googleapis.com/token \
    -d "client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&refresh_token=YOUR_REFRESH_TOKEN&grant_type=refresh_token"
  ```
- Extract `access_token` from response

### 2. Anki Desktop

- [Download and install Anki](https://apps.ankiweb.net/) (2.1.57+)
- Create or import a test deck (optional; you can sync an empty profile)

### 3. Rust Toolchain

- `rustup update stable` (Rust 1.80+)
- `brew install protobuf` (macOS) or `apt install protobuf-compiler` (Linux)

## Running the Test

### Step 1: Build the Sync Server

```bash
cd anki-sync-server
cargo build --bin anki-sync-server
```

Binary lands at `target/debug/anki-sync-server`.

### Step 2: Start the Sync Server with GDrive Backend

```bash
SYNC_USER1=testuser:testpass \
SYNC_STORAGE_PROVIDER=gdrive \
SYNC_OAUTH_TOKEN=<your-gdrive-access-token> \
./target/debug/anki-sync-server
```

Expected output:

```
listening addr=0.0.0.0:8080
```

Leave this running in a terminal. Watch the logs for sync operations.

### Step 3: Configure Anki Desktop for Custom Sync

1. Open **Anki Desktop**
2. Go to **Tools → Preferences → Network**
3. Set:
    - **Sync Server URL:** `http://localhost:8080`
    - **Username:** `testuser`
    - **Password:** `testpass`
4. Click **OK** to close preferences (settings are saved)

### Step 4: Perform First Sync

1. In Anki: **File → Sync** (or **Ctrl+Shift+S** / **Cmd+Shift+S**)
2. Watch the sync server logs for:
    - `fetch collection from storage` message (should succeed; no file on first sync is OK)
    - `commit collection to storage` message (indicates upload to GDrive)
3. Anki Desktop should show "Sync successful" or similar

### Step 5: Verify Collection in Google Drive

1. Open [Google Drive](https://drive.google.com/)
2. Look for folder named **AnkiSync**
3. Inside, you should see **collection.anki2**
4. If first sync was empty, file should be small (~1-10 KB)

### Step 6: Test Incremental Sync

1. In Anki Desktop:
    - Create a new deck or add a card to existing deck
    - Make a small change (e.g., add a note with "Test" as front)
2. **File → Sync** again
3. Watch server logs:
    - `fetch collection from storage` (downloads latest from GDrive)
    - Apply diff from client
    - `commit collection to storage` (uploads updated collection)
4. Verify:
    - Anki shows "Sync successful"
    - GDrive shows updated timestamp on `collection.anki2`
    - Check file size increased (now includes your new content)

### Step 7: Test Sync on Fresh Anki Profile

(Optional, but thorough)

1. Close Anki Desktop
2. Create a new Anki profile (File → Profiles → Create)
3. Configure it with same custom sync settings (localhost:8080, testuser:testpass)
4. Click **File → Download** (full download from server)
5. Verify:
    - Your deck(s) and cards are downloaded
    - Everything synced correctly from GDrive

## Success Criteria

✅ **All of the following must be true:**

- [ ] Sync server starts without errors on `localhost:8080`
- [ ] First sync completes (fetch returns gracefully even if no file exists)
- [ ] Collection file created in GDrive `/AnkiSync/collection.anki2`
- [ ] Incremental syncs work (add card → sync → verify in GDrive)
- [ ] File timestamp/size updates on each sync
- [ ] Fresh profile can download synced content from server
- [ ] No HTTP errors in sync server logs
- [ ] No token expiry errors (if token is valid for 1 hour, all tests should complete)

## Troubleshooting

### "Token expired" or 401 errors

- Your access token TTL is 1 hour. Refresh it or get a new one.
- Check env var was passed correctly:
  ```bash
  echo $SYNC_OAUTH_TOKEN
  ```

### "Folder not found" or 403 errors

- Token may lack `drive.file` scope
- User's GDrive may have restricted folder creation (rare)
- Check GDrive OAuth app permissions in Google Account → Connected apps

### Anki sync hangs or timeout

- Ensure `localhost:8080` is reachable:
  ```bash
  curl http://localhost:8080/health
  ```
- Check firewall isn't blocking port 8080
- Server logs should show request details

### Collection file not appearing in GDrive

- Check GDrive folder permissions (must be writable)
- Verify sync completed (check Anki status + server logs)
- GDrive may cache folder listings; refresh or wait a moment
- Check `/AnkiSync/` folder name spelling (case-sensitive)

### "create storage backend" errors in logs

- Check `SYNC_STORAGE_PROVIDER=gdrive` was set
- Check `SYNC_OAUTH_TOKEN` is not empty
- If using `SYNC_STORAGE_PROVIDER=local`, no token needed (offline mode)

## Notes for M2 (Future)

In M2, this test will evolve:

- Token will be stored encrypted in SQLite `storage_connections` table
- User won't need to set env vars; they'll authenticate via web UI
- Per-user storage config (different users can use different storage providers)
- This test will become: "User logs in → connects GDrive → syncs via Anki → verify in Drive"

For now (M1), the env var approach validates the core wiring works end-to-end.

## See Also

- [Google Drive API Connectivity Research](./research/Google-Drive-API-connectivity.md) — Rate limits, token refresh, upload strategy
- [ADR-0003: Fork Rust Ankitects Sync Server](./decisions/0003-fork-rust-ankitects-sync-server.md) — Sync hook points architecture
- [ADR-0006: Google Drive as Primary Backend](./decisions/0006-use-google-drive-as-the-primary-storage-backend.md) — Storage backend decision
