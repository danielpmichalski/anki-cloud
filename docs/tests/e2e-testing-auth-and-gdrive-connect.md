# E2E Testing: Google OAuth2 Login + Google Drive Connection

Manual test guide for the M2 auth flows: Google login (identity) and Google Drive connection (storage).

## What You're Testing

- ✅ New user can register via Google OAuth2
- ✅ Existing user can log in (upsert is idempotent)
- ✅ JWT session cookie is issued and verified
- ✅ `GET /v1/me` returns correct user data
- ✅ Authenticated user can connect Google Drive
- ✅ OAuth tokens are stored encrypted in `storage_connections`
- ✅ `GET /v1/me/storage` returns connection metadata (no tokens)
- ✅ Re-connecting Google Drive updates tokens (upsert)
- ✅ All protected routes reject unauthenticated requests

## Prerequisites

### 1. Google OAuth App

In [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials:

- OAuth 2.0 Client ID (Web application)
- Authorized redirect URIs must include **both**:
  ```
  http://localhost:3000/v1/auth/google/callback
  http://localhost:3000/v1/me/storage/connect/google/callback
  ```

APIs & Services → Enabled APIs must include:
- Google Drive API (required for Google Drive connection flow)

### 2. Environment

`.env` at the repo root must have:

```env
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/v1/auth/google/callback
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/v1/me/storage/connect/google/callback
JWT_SECRET=<32-byte hex — openssl rand -hex 32>
TOKEN_ENCRYPTION_KEY=<32-byte hex — openssl rand -hex 32>
DATABASE_URL=file:../data/anki-cloud.db
```

### 3. DB Migrated

From `packages/db/`:
```bash
bun run db:migrate
```

### 4. API Running

From `packages/api/`:
```bash
bun run dev
```

Expected: `Listening on http://localhost:3000`

---

## Test 1: Health Check

```bash
curl http://localhost:3000/health
```

**Expected:** `{"status":"ok"}`

---

## Test 2: Unauthenticated Requests Rejected

```bash
curl http://localhost:3000/v1/me
curl http://localhost:3000/v1/me/storage
```

**Expected both:** `{"error":"Unauthenticated","code":"MISSING_SESSION"}` with `401`

---

## Test 3: Google OAuth2 Login — New User

### Step 1: Initiate flow

Open in browser (not curl — needs cookie handling + redirect):

```
http://localhost:3000/v1/auth/google
```

**Expected:**
- Browser redirects to `accounts.google.com`
- URL contains `client_id`, `redirect_uri`, `state`, `code_challenge` params
- Two cookies set before redirect: `oauth_state`, `oauth_code_verifier` (HttpOnly, visible in DevTools → Application → Cookies)

### Step 2: Sign in with Google

Complete sign-in with your Google account.

**Expected:**
- Browser redirects to `http://localhost:3000/v1/auth/google/callback?code=...&state=...`
- Response: `{"ok":true}`
- `session` cookie set (HttpOnly, SameSite=Lax, 30-day expiry)
- `oauth_state` and `oauth_code_verifier` cookies cleared

### Step 3: Verify user in DB

```bash
sqlite3 packages/data/anki-cloud.db "SELECT id, email, name, created_at FROM users;"
```

**Expected:** One row with your Google account email and name.

---

## Test 4: `GET /v1/me` — Authenticated

Copy the `session` cookie value from DevTools, then:

```bash
curl http://localhost:3000/v1/me \
  -H "Cookie: session=<your-session-cookie>"
```

**Expected:**
```json
{
  "id": "<uuid>",
  "email": "<your-google-email>",
  "name": "<your-google-name>",
  "createdAt": "<ISO 8601 timestamp>"
}
```

---

## Test 5: Login Idempotency (Upsert)

Repeat Test 3 (open `/v1/auth/google` again, sign in same account).

**Expected:**
- Flow completes, new `session` cookie
- DB still has exactly **1 row** in `users` for this Google account
- `GET /v1/me` returns same `id` as before

```bash
sqlite3 packages/data/anki-cloud.db "SELECT COUNT(*) FROM users;"
# → 1
```

---

## Test 6: Invalid Session Token

```bash
curl http://localhost:3000/v1/me \
  -H "Cookie: session=totallynotavalidtoken"
```

**Expected:** `{"error":"Invalid or expired session","code":"INVALID_SESSION"}` with `401`

---

## Test 7: CSRF Protection — Invalid State

Craft a callback URL with a wrong state:

```
http://localhost:3000/v1/auth/google/callback?code=fakecode&state=wrongstate
```

**Expected:** `{"error":"Invalid state","code":"INVALID_OAUTH_STATE"}` with `400`

---

## Test 8: Google Drive Connection

**Must be logged in** (session cookie from Test 3 must be active in browser).

### Step 1: Initiate Drive OAuth

In browser (same session):

```
http://localhost:3000/v1/me/storage/connect/google
```

**Expected:**
- Browser redirects to `accounts.google.com` with `drive.file` scope
- Consent screen shows: _"See, edit, create, and delete only the specific Google Drive files you use with this app"_

### Step 2: Approve consent

Click **Allow** on the Google consent screen.

**Expected:**
- Redirects to `http://localhost:3000/v1/me/storage/connect/google/callback`
- Response: `{"ok":true}`

### Step 3: Verify in DB

```bash
sqlite3 packages/data/anki-cloud.db \
  "SELECT user_id, provider, folder_path, connected_at FROM storage_connections;"
```

**Expected:** One row with `provider=google`, `folder_path=/AnkiSync`.

Verify tokens are encrypted (not plaintext):

```bash
sqlite3 packages/data/anki-cloud.db \
  "SELECT length(oauth_token), substr(oauth_token, 1, 20) FROM storage_connections;"
```

**Expected:** Long base64url string (not a `ya29.` Google token).

---

## Test 9: `GET /v1/me/storage` — List Connections

```bash
curl http://localhost:3000/v1/me/storage \
  -H "Cookie: session=<your-session-cookie>"
```

**Expected:**
```json
{
  "connections": [
    {
      "id": "<uuid>",
      "provider": "google",
      "folderPath": "/AnkiSync",
      "connectedAt": "<ISO 8601 timestamp>"
    }
  ]
}
```

Verify `oauthToken` and `oauthRefreshToken` are **absent** from the response.

---

## Test 10: Re-connect Google Drive (Upsert)

Repeat Test 8 (go through Drive OAuth again, same account).

**Expected:**
- Flow completes successfully
- DB still has exactly **1 row** in `storage_connections` for this user
- `connected_at` timestamp updated
- Tokens updated (re-encrypted with new values)

```bash
sqlite3 packages/data/anki-cloud.db "SELECT COUNT(*) FROM storage_connections;"
# → 1
```

---

## Test 11: Drive Connect Requires Auth

Open in browser without a session cookie (use incognito or clear cookies):

```
http://localhost:3000/v1/me/storage/connect/google
```

**Expected:** `{"error":"Unauthenticated","code":"MISSING_SESSION"}` with `401` — redirect to Google does NOT happen.

---

## Success Criteria

All of the following must be true:

- [ ] Health check returns `{"status":"ok"}`
- [ ] Unauthenticated requests to `/v1/me` and `/v1/me/storage` return `401`
- [ ] Google login completes, `session` cookie set, user row in DB
- [ ] `GET /v1/me` returns correct user JSON
- [ ] Logging in twice same account = still 1 user row
- [ ] Invalid session token = `401 INVALID_SESSION`
- [ ] Invalid OAuth state = `400 INVALID_OAUTH_STATE`
- [ ] Google Drive consent shows `drive.file` scope
- [ ] Drive connect completes, `storage_connections` row in DB
- [ ] Token stored as encrypted base64url (not plaintext)
- [ ] `GET /v1/me/storage` returns connection without token fields
- [ ] Re-connecting = still 1 `storage_connections` row, tokens updated
- [ ] Drive connect without session = `401`

## Troubleshooting

### `redirect_uri_mismatch`

Both redirect URIs must be added to Google Cloud Console → OAuth app → Authorized redirect URIs exactly as listed in Prerequisites.

### `JWT_SECRET` or `TOKEN_ENCRYPTION_KEY` errors on startup

```bash
openssl rand -hex 32  # generate each
```

Add both to `.env` at repo root.

### `drive.file` scope not showing on consent screen

- Verify Google Drive API is enabled in Cloud Console → APIs & Services → Enabled APIs
- `drive.file` is less permissive than `drive` — it should show a scoped message

### Drive consent screen says "unverified app"

Normal for development. Click **Advanced → Go to (app name) (unsafe)**.

### DB file not found

```bash
cd packages/db && bun run db:migrate
```

### Session cookie not sent by curl

Browser-based tests are required for steps involving OAuth redirects. Use DevTools to copy the `session` cookie value for curl-based tests.

## See Also

- [E2E Testing: Google Drive Sync Integration](./e2e-testing-gdrive-sync.md) — Rust sync server + Google Drive adapter
- [ADR-0004: OAuth2 Authentication](../decisions/0004-use-oauth2-for-authentication-no-password-storage.md)
- [ADR-0005: Google as OAuth Provider](../decisions/0005-use-google-as-the-sole-oauth-provider-mvp.md)
