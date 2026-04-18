# E2E Testing: Sync Password + Anki Desktop Integration

Manual test guide for the M2 sync password flow: generating credentials via web UI and API,
syncing Anki Desktop with a locally running server, and verifying password rotation.

## What You're Testing

- ✅ Sync password is generated on first `GET /v1/me/sync-password` (shown once)
- ✅ Subsequent calls return `password: null` (already set)
- ✅ `POST /v1/me/sync-password/reset` issues a new password, old one stops working
- ✅ Web UI shows sync credentials card, copy button, reset button
- ✅ Anki Desktop can authenticate with email + sync password via `/sync/hostKey`
- ✅ Wrong password returns `403`
- ✅ Anki Desktop sync completes end-to-end (collection written to storage)
- ✅ After password reset, Anki must re-authenticate with new credentials

---

## Prerequisites

### 1. Full stack running

From the repo root:

```bash
# Terminal 1 — API server
cd packages/api && bun run dev
# Expected: Listening on http://localhost:3000

# Terminal 2 — Rust sync server
cd anki-sync-server
cargo build --bin anki-sync-server   # first time only
SYNC_PORT=27701 SYNC_BASE=~/.anki-cloud-sync \
  DATABASE_URL=file:$(realpath ../packages/data/anki-cloud.db) \
  TOKEN_ENCRYPTION_KEY=<your-32-byte-hex> \
  GOOGLE_CLIENT_ID=<your-google-client-id> \
  GOOGLE_CLIENT_SECRET=<your-google-client-secret> \
  ./target/debug/anki-sync-server
# Expected: listening addr=0.0.0.0:27701

# Tip: DATABASE_URL must be an absolute path — the relative form ../data/... breaks
# depending on the working directory. Use $(realpath ...) or $(pwd) to be safe.

# Shortcut: source .env from the repo root (contains all vars except SYNC_PORT/SYNC_BASE):
#   cd anki-sync-server
#   set -a && source ../.env && set +a
#   SYNC_PORT=27701 SYNC_BASE=~/.anki-cloud-sync \
#     DATABASE_URL=file:$(realpath ../data/anki-cloud.db) \
#     ./target/debug/anki-sync-server

# Terminal 3 — Web UI
cd web && bun run dev
# Expected: Local: http://localhost:5173
```

> **Sync server port:** Anki Desktop hardcodes port 27701 for custom sync servers. Use that
> port or adjust the custom URL in Anki preferences accordingly.

### 2. DB migrated and user exists

Run migrations if you haven't already:

```bash
cd packages/db && bun run db:migrate
```

Expected: migration SQL files applied, `data/anki-cloud.db` created with all tables.

If you have not logged in yet, complete the Google OAuth flow first
(see [e2e-testing-auth-and-gdrive-connect.md](./e2e-testing-auth-and-gdrive-connect.md)).

```bash
sqlite3 data/anki-cloud.db "SELECT id, email FROM users;"
```

Copy your `user_id` — you'll need it for curl-based tests below.

### 3. Session cookie

Log in at `http://localhost:3000/v1/auth/google` in your browser.
Copy the `session` cookie value from DevTools → Application → Cookies → `localhost`.

### 4. GDrive connected (for full Anki sync)

Complete the GDrive connect flow if you haven't already, or the sync server will fail when
Anki tries to fetch/commit the collection.

For a **local storage** quick test (no GDrive needed):

```bash
sqlite3 data/anki-cloud.db "
INSERT INTO storage_connections (id, user_id, provider, oauth_token, oauth_refresh_token, folder_path)
VALUES (lower(hex(randomblob(16))), '<your-user-id>', 'local', '', NULL, '/AnkiSync');
"
```

### 5. Anki Desktop

- Version 25.09 or newer
- Any profile is fine (even empty)

---

## Test 1: API Health Check

```bash
curl http://localhost:3000/health
```

**Expected:** `{"status":"ok"}`

```bash
curl http://localhost:27701/health
```

**Expected:** `"health check"` or `200 OK`

---

## Test 2: Generate Sync Password (First Time)

```bash
curl http://localhost:3000/v1/me/sync-password \
  -H "Cookie: session=<your-session-cookie>"
```

**Expected:**
```json
{
  "username": "you@gmail.com",
  "password": "aBcDeFgH1234..."
}
```

- `password` is a random alphanumeric string (32 chars)
- **This is the only time it is returned in plaintext** — copy it now

---

## Test 3: Second Call Returns `null` Password

```bash
curl http://localhost:3000/v1/me/sync-password \
  -H "Cookie: session=<your-session-cookie>"
```

**Expected:**
```json
{
  "username": "you@gmail.com",
  "password": null
}
```

`password: null` means "already set; we won't show it again."

---

## Test 4: Verify Hash in DB

```bash
sqlite3 data/anki-cloud.db \
  "SELECT email, substr(sync_password_hash, 1, 7) as hash_prefix FROM users;"
```

**Expected:** `hash_prefix` starts with `$2b$` (bcrypt format). Never plaintext.

---

## Test 5: Web UI — Sync Password Card

1. Open `http://localhost:5173` in browser
2. Log in if prompted
3. Scroll to **Sync Password** section

If password was just generated (Tests 2-3 above already called the endpoint):
- Shows **masked** display + **Reset sync password** button
- Shows **username** (your email) with copy button
- Shows instructions: _"Enter this username and password in Anki → Preferences → Syncing"_

To see the reveal banner:

1. Reset the password first (Test 9 below), then reload the page
2. You should see the blue banner with the new password + copy button + _"you won't see this again"_ note

---

## Test 6: Configure Anki Desktop

1. Open **Anki Desktop**
2. **Tools → Preferences → Syncing** (on Mac: **Anki → Preferences → Syncing**)
3. Set:
   - **Self-hosted sync server:** `http://localhost:27701`
   - Click **OK** and **restart Anki** when prompted
4. After restart, Anki will ask for login credentials:
   - **Username:** your email (e.g. `you@gmail.com`)
   - **Password:** the sync password from Test 2

---

## Test 7: Full Sync — First Sync

1. In Anki Desktop: **File → Sync** (or `Cmd+Shift+S` / `Ctrl+Shift+S`)
2. Watch sync server logs for:
   ```
   request{uri="/sync/hostKey"} finished httpstatus=200
   request{uri="/sync/meta"} finished httpstatus=200
   ```
3. Anki should show **"Sync complete"** (or no error dialog)

**Verify hkey stored in DB:**

```bash
sqlite3 data/anki-cloud.db \
  "SELECT u.email, s.sync_key FROM users u JOIN users_sync_state s ON s.user_id = u.id;"
```

**Expected:** One row with your email and a 40-char hex hkey.

---

## Test 8: Wrong Password Returns 403

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:27701/sync/hostKey \
  -H "anki-sync: {\"v\":11,\"k\":\"\",\"c\":\"test\",\"s\":\"\"}" \
  -H "content-type: application/octet-stream" \
  --data-binary @<(python3 -c "
import sys, json, zlib
# Note: Anki uses zstd; this curl test uses a direct approach
# Use the e2e test suite for precise protocol testing
")
```

> Easier approach: change the password in Anki prefs to something wrong, then try syncing.

**Expected in sync server logs:**

```
context="invalid user/pass" source=Some(invalid credentials) httpstatus=403
```

Anki Desktop will show a login dialog or "Sync failed" error.

---

## Test 9: Reset Sync Password via API

```bash
curl -s -X POST http://localhost:3000/v1/me/sync-password/reset \
  -H "Cookie: session=<your-session-cookie>" | jq .
```

**Expected:**
```json
{
  "username": "you@gmail.com",
  "password": "XyZ9newPassword..."
}
```

New password is different from the one generated in Test 2.

---

## Test 10: Old Password Rejected After Reset

In Anki Desktop, **do not update the credentials yet**.

1. File → Sync
2. Sync server logs should show `httpstatus=403` for `/sync/hostKey`
3. Anki shows a login/error dialog — the old credentials are now invalid

---

## Test 11: New Password Works

1. In Anki Desktop, enter the new password from Test 9 when prompted
   (or: Tools → Preferences → Syncing → log out, then log in with new password)
2. File → Sync again
3. **Expected:** Sync completes successfully, `httpstatus=200` in logs

---

## Test 12: Web UI Reset Flow

1. Open `http://localhost:5173` → Sync Password section
2. Click **Reset sync password**
3. Confirm in the dialog
4. Page should immediately show the blue banner with the new password
5. Reload page → banner gone, masked display shown → confirms only-once behaviour

---

## Test 13: Sync Server Restart — Re-hydration

This tests that the in-memory session map is rebuilt from DB after a restart.

1. Sync successfully so an hkey is stored in `users_sync_state.sync_key`
2. Stop and restart the sync server (Ctrl+C, then re-run)
3. In Anki Desktop: File → Sync
4. **Expected:** Sync completes without re-entering credentials — hkey re-hydrated from DB

Sync server logs should show the `with_authenticated_user` path completing via DB lookup
(no `hostKey` request — Anki reuses the cached hkey):
```
request{uri="/sync/meta"} finished httpstatus=200
```

---

## Success Criteria

- [ ] `GET /v1/me/sync-password` → password returned on first call, `null` on second
- [ ] `POST /v1/me/sync-password/reset` → new password returned, different from old
- [ ] DB `sync_password_hash` starts with `$2b$` (bcrypt), never plaintext
- [ ] Web UI shows Sync Password card with username, copy button, reset button
- [ ] Reveal banner shown only when password was just generated/reset
- [ ] Anki Desktop authenticates with email + sync password
- [ ] `/sync/hostKey` returns `200` for correct credentials
- [ ] `/sync/hostKey` returns `403` for wrong password
- [ ] `/sync/hostKey` returns `403` for unknown email
- [ ] Full Anki sync completes (collection written to storage)
- [ ] `users_sync_state.sync_key` populated after first sync
- [ ] Old password rejected (`403`) after reset
- [ ] New password accepted after reset
- [ ] Sync server restart + sync = re-hydration works (no 403, no re-login)

---

## Troubleshooting

### Anki shows "Unable to connect to sync server"

```bash
curl http://localhost:27701/health
```

If that fails, the sync server isn't running or is on the wrong port. Verify `SYNC_PORT=27701`.

### Anki shows login dialog every sync

The hkey persists in `users_sync_state` across restarts. If Anki keeps asking for credentials,
check the DB:

```bash
sqlite3 data/anki-cloud.db \
  "SELECT sync_key FROM users_sync_state WHERE user_id = (SELECT id FROM users WHERE email = 'you@gmail.com');"
```

Empty `sync_key` means the `hostKey` call didn't complete — check sync server logs for errors.

### `403` on `/sync/hostKey` — "unable to open database file"

`DATABASE_URL` is a relative path that doesn't resolve from the binary's working directory.
Use an absolute path:

```bash
DATABASE_URL=file:$(realpath ../data/anki-cloud.db)
```

### `403` on `/sync/hostKey` with correct password

Likely the password hash in DB is stale. Check:

```bash
sqlite3 data/anki-cloud.db \
  "SELECT sync_password_hash IS NOT NULL as has_hash FROM users WHERE email = 'you@gmail.com';"
```

If `0`, no password has been generated — call `GET /v1/me/sync-password` first.

### `500` on `/sync/hostKey`

Check sync server logs for the `source` field. Common causes:

- `"open media db" kind: Locked` — stale session entry after password reset. Fixed in current
  build (`ensure_user` evicts old entries before opening media DB).
- `"store sync key"` error — DB write failed. Check `DATABASE_URL` env var points to the same
  DB as the API server.

### Web UI doesn't show Sync Password section

Ensure you're logged in and the API server is running. Open DevTools → Network and check
that `GET /v1/me/sync-password` returns `200` (not `401`).

### GDrive sync fails after local storage insert

Ensure the `provider` value is exactly `local` (lowercase) in the `storage_connections` row.

---

## See Also

- [E2E Testing: Google OAuth2 Login + GDrive Connection](./e2e-testing-auth-and-gdrive-connect.md)
- [E2E Testing: GDrive Sync Integration](./e2e-testing-gdrive-sync.md)
- [ADR-0003: Fork Rust Ankitects Sync Server](../decisions/0003-fork-rust-ankitects-sync-server.md)
