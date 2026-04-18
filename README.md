# anki-cloud

A privacy-first, open-source Anki sync server with a first-class REST API and MCP server,
enabling seamless LLM-to-Anki workflows. User deck data lives in their own cloud storage
(Google Drive, Dropbox, etc.) — this service is stateless infrastructure that never holds
user data.

> **Trademark note:** "Anki" is a registered trademark of Ankitects Pty Ltd. This project
> is not affiliated with or endorsed by Ankitects.

---

## Local dev setup (macOS)

Run the setup script once to install all required tools:

```bash
./scripts/setup.zsh
```

This installs (skipping anything already present):

| Tool                                                                 | Purpose                                                          |
|----------------------------------------------------------------------|------------------------------------------------------------------|
| [Rust](https://rustup.rs) ≥ 1.80 + Cargo                            | Sync server (`anki-sync-server/`)                                |
| [protoc](https://protobuf.dev)                                       | Compiles `.proto` files during Rust build                        |
| [Bun](https://bun.sh)                                                | TypeScript runtime for REST API, MCP server, web UI              |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/)   | Full stack via `docker compose up` (install separately)          |

After running the script, reload your shell:

```bash
source ~/.zshrc
```

---

## Build & run

### Sync server (Rust)

```bash
cd anki-sync-server
cargo build --bin anki-sync-server

SYNC_USER1=user:password ./target/debug/anki-sync-server
# Listening on 0.0.0.0:8080
```

See [`anki-sync-server/README.md`](anki-sync-server/README.md) for all configuration options.

### Full stack (Docker)

```bash
cp .env.example .env   # fill in Google OAuth credentials
docker compose up
```

---

## Project structure

```
anki-sync-server/   Rust workspace — fork of ankitects/anki rslib@25.09
api/                REST API — TypeScript / Hono on Bun
mcp/                MCP server — wraps REST API
web/                Account management UI
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
