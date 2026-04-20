# e2e tests

Integration test suite covering the full stack: REST API, SQLite DB, and Rust sync server.

## Prerequisites

1. **Rust sync server binary** — must be built before running tests:
   ```bash
   cd anki-sync-server
   cargo build --bin anki-sync-server
   ```

2. **Node dependencies** — install from repo root:
   ```bash
   bun install
   ```

## Run

```bash
cd e2e
bun test
```

Tests start their own isolated API + sync server processes with a temporary SQLite DB,
so they can run without any external services.

## What's tested

| File | Coverage |
|------|----------|
| `01-api-health.test.ts` | REST API health check |
| `02-sync-credentials.test.ts` | Sync password generation, idempotency, reset via `GET/POST /v1/me/sync-password` |
| `03-sync-server.test.ts` | Anki sync protocol v11: hostKey auth, 403 on wrong/unknown user, in-memory session re-use |
| `04-sync-password-rotation.test.ts` | Password reset invalidates old credentials, new ones work |

## Architecture notes

- Each test suite calls `startStack()` which spawns fresh API + sync server processes with a temp DB.
- Sessions are seeded directly into the DB (skipping Google OAuth) via `createTestSession()`.
- Storage connections use `provider = "local"` so no cloud credentials are needed.
- Sync requests use Anki sync protocol v11: `anki-sync` header + zstd-compressed JSON body.
