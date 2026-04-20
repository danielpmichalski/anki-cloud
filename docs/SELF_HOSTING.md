# Self-Hosting Guide

Get your own sync server running in under 10 minutes. All you need is Docker and a Google account.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- A Google account (for OAuth login and Google Drive storage)

No other tools required.

---

## Step 1 — Create a Google OAuth app

You need a Google OAuth 2.0 app to handle sign-in and Google Drive access.

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a project (or use an existing one).
2. Navigate to **APIs & Services → Library**, search for **Google Drive API**, and enable it.
3. Navigate to **APIs & Services → OAuth consent screen**:
    - Choose **External** user type.
    - Fill in app name, support email, and developer contact.
    - Add scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file`
    - Under **Test users**, click **Add users** and enter your Google account email (e.g. `you@gmail.com`). Only listed test users can sign in while the app is in **Testing** publishing status — if you skip this, sign-in
      will fail with an "access blocked" error.
4. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
    - Application type: **Web application**
    - Add these **Authorized redirect URIs**:
      ```
      http://localhost:3000/v1/auth/callback/google
      http://localhost:5173/v1/me/storage/connect/gdrive/callback
      ```
5. Copy the **Client ID** and **Client Secret** — you'll need them in the next step.

---

## Step 2 — Clone and configure

```bash
git clone https://github.com/danielpmichalski/anki-cloud
cd anki-cloud
cp .env.example .env
```

Open `.env` and fill in the required values:

```bash
# Generate random secrets (run these commands, paste the output):
# openssl rand -hex 32
SIDECAR_TOKEN=<generated>
BETTER_AUTH_SECRET=<generated>
TOKEN_ENCRYPTION_KEY=<generated>

# Public base URL of the API server — used by Better Auth for OAuth callbacks
BETTER_AUTH_URL=http://localhost:3000

# From Step 1
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Must match the redirect URI you registered in Google Cloud Console
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:5173/v1/me/storage/connect/gdrive/callback

# Where to redirect after OAuth flows complete
FRONTEND_URL=http://localhost:5173
```

The remaining variables in `.env.example` have sensible defaults and don't need to change for local self-hosting.

---

## Step 3 — Start the stack

```bash
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up
```

First run pulls the images (~500 MB). Subsequent starts are instant.

Once running:

| URL                          | Purpose                   |
|------------------------------|---------------------------|
| `http://localhost:5173`      | Account management web UI |
| `http://localhost:8080`      | Anki sync server endpoint |
| `http://localhost:3000/docs` | Interactive API reference |

---

## Step 4 — Sign in and connect Google Drive

1. Open `http://localhost:5173` in your browser.
2. Click **Sign in with Google** and complete the OAuth flow.
3. Once signed in, click **Connect Google Drive** under Storage.
4. Authorize the Drive access — scope is `drive.file` (only files this app creates).
5. A `/AnkiCloudSync` folder is created in your Drive. Your deck data will live here.

---

## Step 5 — Point Anki Desktop at your sync server

1. Generate a sync password in the web UI under **Sync → Generate password**. Copy it — it's shown once.
2. In Anki Desktop: **Preferences → Syncing → Self-hosted sync server**, set URL to:
   ```
   http://localhost:8080
   ```
3. Sign out of AnkiWeb if prompted, then sync. Anki will ask for credentials:
    - **Username:** your Google account email
    - **Password:** the sync password from step 1

Your decks will now sync to/from your Google Drive.

---

## Step 6 — Generate an API key

API keys let LLMs (via MCP) read and write your Anki cards.

1. In the web UI, go to **Account → API Keys → New key**. Give it a label (e.g. `claude-desktop`).
2. Copy the key — it starts with `ak_` and is shown once.
3. Connect with REST API using Bearer token Authorization in Claude Desktop.

---

## Staying up to date

```bash
docker compose -f docker-compose.yml -f docker-compose.cloud.yml pull
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up
```

---

## Troubleshooting

**OAuth redirect mismatch error**
Verify the redirect URIs in Google Cloud Console exactly match those derived from `BETTER_AUTH_URL` and `GOOGLE_DRIVE_REDIRECT_URI` in your `.env`. For local dev: `http://localhost:3000/v1/auth/callback/google` (sign-in)
and `http://localhost:5173/v1/me/storage/connect/gdrive/callback` (Drive). Trailing slashes and `http` vs `https` matter.

**Anki says "sync server not configured"**
Ensure the sync URL in Anki is `http://localhost:8080` (no trailing slash) and the stack is running.

**Container fails to start with "TOKEN_ENCRYPTION_KEY" error**
Generate the key with `openssl rand -hex 32` and add it to `.env`.

**Data persists across restarts?**
Yes — the SQLite database and any local-mode deck data are stored in a Docker volume (`app-data`). Google Drive data persists in your Drive regardless.
