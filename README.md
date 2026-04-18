# anki-cloud

A privacy-first, open-source Anki sync server with a first-class REST API and MCP server,
enabling seamless LLM-to-Anki workflows. User deck data lives in their own cloud storage
(Google Drive, Dropbox, etc.) — this service is stateless infrastructure that never holds
user data.

> **Trademark note:** "Anki" is a registered trademark of Ankitects Pty Ltd. This project
> is not affiliated with or endorsed by Ankitects.

---

## Running the sync server

There are two ways to run the sync server:

- with Docker (recommended, no toolchain required), or
- by building from source (for development).

See also [`anki-sync-server/README.md`](anki-sync-server/README.md) for all configuration options
(storage backend, OAuth token, port, etc.).

To use the Google Drive backend, you'll need a
GDrive OAuth access token — see [Getting a GDrive OAuth token](docs/e2e-testing-gdrive-sync.md#1-google-drive-oauth-access-token).

### Option A — Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env   # fill in sync credentials
docker compose up
```

The first run builds the image (~2–3 min). Subsequent starts are instant.

### Option B — Build from source

Requires Rust ≥ 1.80 and `protoc`. Run the setup script once to install both:

```bash
./scripts/setup.zsh
source ~/.zshrc
```

Then build and run:

```bash
cd anki-sync-server
cargo build --bin anki-sync-server

DATABASE_URL=file:/path/to/anki-cloud.db \
  TOKEN_ENCRYPTION_KEY=<64-hex-chars> \
  GOOGLE_CLIENT_ID=<client-id> \
  GOOGLE_CLIENT_SECRET=<client-secret> \
  ./target/debug/anki-sync-server
# Listening on 0.0.0.0:8080
```

Users are authenticated via sync passwords set in the web UI — no `SYNC_USER*` env vars needed.

---

## Connecting Anki Desktop

In Anki: **Preferences → Syncing → Self-hosted sync server**, set the URL to:

```
http://localhost:8080
```

---

## Local dev setup

Run the setup script to install all required tools (skips anything already present):

```bash
./scripts/setup.zsh
```

| Tool                                                              | Purpose                                                 |
|-------------------------------------------------------------------|---------------------------------------------------------|
| [Rust](https://rustup.rs) ≥ 1.80 + Cargo                          | Sync server (`anki-sync-server/`)                       |
| [protoc](https://protobuf.dev)                                    | Compiles `.proto` files during Rust build               |
| [Bun](https://bun.sh)                                             | TypeScript runtime for REST API, MCP server, web UI     |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Full stack via `docker compose up` (install separately) |

---

## Project structure

```
anki-sync-server/   Rust workspace — fork of ankitects/anki rslib@25.09
packages/api/       REST API — TypeScript / Hono on Bun
packages/db/        Drizzle ORM + SQLite schema (@anki-cloud/db)
web/                Account management UI (Vite + React)
docs/               Architecture decisions (ADRs) + narrative docs
scripts/            Dev tooling (setup, SDK generation, sync-server fork)
```

Full architecture and design decisions: [CLAUDE.md](CLAUDE.md)

---

## Upgrading the upstream sync server

```bash
./scripts/fork-anki-sync-server.zsh <new-tag>   # e.g. 25.12
cd anki-sync-server && cargo build --bin anki-sync-server
```

---

## License

AGPLv3 — see [LICENSE](LICENSE).
