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

### Standalone mode

No database or cloud storage required. Users are defined via `SYNC_USER1` in `.env`.
Good for local development and testing the REST API without GDrive setup.

```bash
cp .env.example .env   # set SIDECAR_TOKEN, JWT_SECRET, SYNC_USER1 at minimum
docker compose -f docker-compose.yml -f docker-compose.standalone.yml up
```

### Cloud mode

Full production-like stack. Users authenticate via Google OAuth; deck data stored in their
Google Drive. Requires all OAuth credentials in `.env`.

```bash
cp .env.example .env   # fill in all credentials
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up
```

The first run builds the sync server image (~2–3 min). Subsequent starts are instant.

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

| Tool                                                              | Purpose                                             |
|-------------------------------------------------------------------|-----------------------------------------------------|
| [Bun](https://bun.sh)                                             | TypeScript runtime for REST API, MCP server, web UI |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Full stack via `docker compose` (install separately) |
| [Rust](https://rustup.rs) ≥ 1.80 + `protoc`                      | Only needed to build anki-cloud-sync from source    |

---

## Project structure

```
api/        REST API — TypeScript / Hono on Bun
db/         Drizzle ORM + SQLite schema (@anki-cloud/db)
web/        Account management UI (Vite + React)
docs/       Architecture decisions (ADRs) + narrative docs
scripts/    Dev tooling (setup, SDK generation)

docker-compose.yml              Base stack (api + anki-sync-server)
docker-compose.standalone.yml   Standalone mode override (no DB/GDrive)
docker-compose.cloud.yml        Cloud mode override (SQLite + GDrive OAuth)
```

The sync server lives in a separate repository:
[github.com/danielpmichalski/anki-cloud-sync](https://github.com/danielpmichalski/anki-cloud-sync) —
see its README for all configuration options and environment variables.

Full architecture and design decisions: [CLAUDE.md](CLAUDE.md)

---

## License

Elastic License 2.0 (ELv2) — source-available, self-hosting permitted. See [LICENSE](LICENSE).
