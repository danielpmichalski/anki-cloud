# @anki-cloud/api

REST API for anki-cloud. Built with Hono on Bun. Handles authentication, account management, and all deck/note/card operations.

Depends on `@anki-cloud/db` for data access.

## Environment variables

| Variable               | Required | Description                                                     |
|------------------------|----------|-----------------------------------------------------------------|
| `PORT`                 | No       | HTTP port (default: `3000`)                                     |
| `DATABASE_URL`         | No       | SQLite file URI (default: `file:../data/anki-cloud.db`)         |
| `TOKEN_ENCRYPTION_KEY` | Yes      | 32-byte hex key — must match the value used by `@anki-cloud/db` |

## Scripts

```bash
bun run dev       # start with hot reload
bun run start     # start for production
bun run typecheck # TypeScript type check
```
