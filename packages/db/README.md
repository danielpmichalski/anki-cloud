# @anki-cloud/db

Database layer for anki-cloud. Provides the SQLite schema, migrations, typed Drizzle client, and OAuth token encryption.

## What's in here

- **Schema** — 4 tables: `users`, `storage_connections`, `users_api_keys`, `users_sync_state`
- **Migrations** — managed by drizzle-kit, committed to git, run on startup
- **DB client** — singleton with WAL mode, foreign key enforcement, busy timeout
- **Encryption** — AES-256-GCM encrypt/decrypt for OAuth tokens at rest

## Usage

```ts
import {db, users, storageConnections} from "@anki-cloud/db";

const user = await db.select().from(users).where(eq(users.googleSub, sub));
```

```ts
import {encrypt, decrypt} from "@anki-cloud/db/encrypt";

const stored = await encrypt(accessToken);
const token = await decrypt(stored);
```

## Environment variables

| Variable               | Required | Description                                                                 |
|------------------------|----------|-----------------------------------------------------------------------------|
| `DATABASE_URL`         | No       | SQLite file URI (default: `file:./data/anki-cloud.db`)                      |
| `TOKEN_ENCRYPTION_KEY` | Yes      | 32-byte hex key for token encryption — generate with `openssl rand -hex 32` |

## Scripts

```bash
bun run db:generate   # generate migration from schema changes
bun run db:migrate    # apply pending migrations
bun run db:studio     # open Drizzle Studio
bun run typecheck     # TypeScript type check
```
