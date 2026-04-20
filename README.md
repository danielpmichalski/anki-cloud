# anki-cloud

A privacy-first, open-source Anki sync server with a first-class REST API and MCP server,
enabling seamless LLM-to-Anki workflows. User deck data lives in their own cloud storage
(Google Drive, Dropbox, etc.) — this service is stateless infrastructure that never holds
user data.

> **Trademark note:** "Anki" is a registered trademark of Ankitects Pty Ltd. This project
> is not affiliated with or endorsed by Ankitects.

---

## Running the stack

The sync server ([anki-cloud-sync](https://github.com/danielpmichalski/anki-cloud-sync)) is a
separate Rust service consumed here as a Docker image or local build. Two run modes are supported:

Two independent axes: **mode** (standalone vs cloud) and **image source** (published vs local build).

### Standalone mode

No database or cloud storage required. Users defined via `SYNC_USER1` in `.env`.
Good for local development and testing the REST API without Google Drive setup.

```bash
cp .env.example .env   # set SIDECAR_TOKEN, BETTER_AUTH_SECRET, SYNC_USER1 at minimum

# published image (fast)
docker compose -f docker-compose.yml -f docker-compose.standalone.yml up

# local build of anki-cloud-sync (when hacking on the sync server)
docker compose --build -f docker-compose.yml -f docker-compose.standalone.yml -f docker-compose.dev.yml up
```

### Cloud mode

Full production-like stack. Users authenticate via Google or GitHub OAuth (via Better Auth); deck data
stored in their Google Drive. Requires OAuth credentials in `.env`.

Before running, register these callback URIs in your OAuth apps:

**Google** ([Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials):

```
{BETTER_AUTH_URL}/v1/auth/callback/google          # sign-in callback
{FRONTEND_URL}/v1/me/storage/connect/google/callback  # Google Drive callback
```

**GitHub** (optional — [Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)):

```
{BETTER_AUTH_URL}/v1/auth/callback/github          # sign-in callback
```

Set `TRUSTED_ORIGINS` in `.env` to your frontend URL(s) (comma-separated) so Better Auth accepts
requests from the web UI. Defaults to `FRONTEND_URL` if unset.

```bash
cp .env.example .env   # fill in all credentials

# published image
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up

# local build of anki-cloud-sync
docker compose --build -f docker-compose.yml -f docker-compose.cloud.yml -f docker-compose.dev.yml up
```

`docker-compose.dev.yml` switches `anki-sync-server` from the published image to a local build
of `../anki-cloud-sync`. First build takes ~2–3 min; subsequent starts are instant.

---

## API reference

Once the stack is running, two endpoints are available:

| URL                                  | Purpose                                                      |
|--------------------------------------|--------------------------------------------------------------|
| `http://localhost:3000/openapi.json` | OpenAPI 3.1 spec — import into Postman via **Import → Link** |
| `http://localhost:3000/docs`         | Scalar interactive UI                                        |

All data endpoints (`/v1/decks/*`, `/v1/notes/*`, `/v1/cards/*`) require an API key:

```
Authorization: Bearer ak_<your-key>
```

Generate a key in the web UI under **Account → API Keys**, or via `POST /v1/me/api-keys`.

Account management endpoints (`/v1/me/*`) use the session cookie set by [Better Auth](https://better-auth.com) after Google or GitHub OAuth login. The auth handler is mounted at `/v1/auth/*`.

---

## MCP integration (LLM → Anki)

The MCP server lets any LLM (Claude Desktop, API clients) manage your decks and notes directly:

```
User: "Create flashcards from this discussion"
LLM:  "<calls create_notes_bulk> → cards appear in Anki instantly"
```

**Claude Desktop setup** — add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "anki-cloud": {
      "command": "bun",
      "args": ["run", "/path/to/anki-cloud/mcp/src/index.ts"],
      "env": {
        "API_URL": "http://localhost:3000",
        "API_KEY": "ak_your_key_here"
      }
    }
  }
}
```

Generate an API key in the web UI under **Account → API Keys**, replace the path and key, then restart Claude Desktop.

Full setup guide, available tools, and Docker deployment: [docs/mcp-integration.md](docs/mcp-integration.md)

---

## Connecting Anki Desktop

In Anki: **Preferences → Syncing → Self-hosted sync server**, set the URL to:

```
http://localhost:8080
```

In standalone mode, use the `SYNC_USER1` credentials (email:password) when Anki prompts for login.

---

## Local dev setup

Run the setup script to install all required tools (skips anything already present):

```bash
./scripts/setup.zsh
```

| Tool                                                              | Purpose                                              |
|-------------------------------------------------------------------|------------------------------------------------------|
| [Bun](https://bun.sh)                                             | TypeScript runtime for REST API, MCP server, web UI  |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Full stack via `docker compose` (install separately) |
| [Rust](https://rustup.rs) ≥ 1.80 + `protoc`                       | Only needed to build anki-cloud-sync from source     |

### Installing dependencies

`api/` and `db/` share a Bun workspace — one install covers both:

```bash
bun install
```

`web/` and `e2e/` are standalone packages (not in the workspace) — install separately when
working on them:

```bash
cd web && bun install   # account management UI
cd e2e && bun install   # end-to-end tests
```

### Running packages locally (without Docker)

```bash
# REST API (hot-reload)
bun run --hot api/src/index.ts

# Web UI (Vite dev server, http://localhost:5173)
cd web && bun run dev

# E2E tests (requires the full stack running)
cd e2e && bun test
```

---

## Project structure

```
api/        REST API — TypeScript / Hono on Bun  (shared workspace with db/ and mcp/)
db/         Drizzle ORM + SQLite schema (@anki-cloud/db)
mcp/        MCP server — wraps REST API, 8 tools for LLM integration
web/        Account management UI (Vite + React)  (standalone — cd web && bun install)
e2e/        End-to-end tests                      (standalone — cd e2e && bun install)
docs/       Architecture decisions (ADRs) + narrative docs
scripts/    Dev tooling (setup, SDK generation)

docker-compose.yml              Base stack (api + anki-sync-server)
docker-compose.standalone.yml   Standalone mode override (no DB/Google Drive)
docker-compose.cloud.yml        Cloud mode override (SQLite + Google Drive OAuth)
docker-compose.dev.yml          Local build of anki-cloud-sync (any mode)
```

The sync server lives in a separate repository:
[github.com/danielpmichalski/anki-cloud-sync](https://github.com/danielpmichalski/anki-cloud-sync) —
see its README for all configuration options and environment variables.

Full self-hosting walkthrough (Google OAuth setup, Google Drive, Anki Desktop, Claude Desktop): [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)

Full architecture and design decisions: [CLAUDE.md](CLAUDE.md)

---

## License

Elastic License 2.0 (ELv2) — source-available, self-hosting permitted. See [LICENSE](LICENSE).
