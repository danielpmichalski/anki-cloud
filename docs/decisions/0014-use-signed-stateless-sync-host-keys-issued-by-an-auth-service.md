# 14. Use signed, stateless sync host keys issued by an auth service

Date: 2026-11-19

## Status

Proposed (not implemented). The MVP keeps the shared SQLite database from
[ADR 0012](0012-use-sqlite-for-mvp-with-turso-migration-path-for-multi-node-horizontal-scaling.md).
This ADR records the direction to take when the sync server must stop sharing a database with the API.

## Context

### What a host key is

Anki clients (desktop, AnkiDroid, AnkiMobile) sync in two steps:

1. `POST /sync/hostKey` with username and password. The server answers with a **host key** (`hkey`).
2. Every later request (`meta`, `start`, `chunk`, `finish`, `download`, ...) carries that `hkey` in the
   `anki-sync` header instead of the password. The client stores it and reuses it until the server rejects it.

The client treats the `hkey` as an opaque string. The server decides what it means.

### How it works today

`CloudAuthProvider` in `sync-platform-cloud/src/lib.rs`:

- `authenticate()` checks the password against `user_sync_config.sync_password_hash`, derives
  `hkey = SHA1("user:password")` and stores it in `user_sync_state.sync_key`.
- `lookup_by_hkey()` runs a `SELECT` on `user_sync_state` for every single sync request to map the `hkey` back to
  a user.

The `BackendResolver` also reads the encrypted Google refresh token from `user_storage_connection`, decrypts it
with `TOKEN_ENCRYPTION_KEY` and exchanges it for an access token.

So the sync server reads and writes the API's database, holds the encryption key and sees refresh tokens. That
couples both deployments to one SQLite file on one volume, and a compromise of the public sync endpoint exposes
every user's Drive refresh token.

Calling the REST API from the sync server instead was rejected: it adds a hard runtime dependency, and users
must still be able to sync while the API or MCP server is down.

## Decision

Introduce an **auth service** (initially a module inside the API process, extracted later) as the only owner of
user data, sync passwords and storage tokens, and make host keys **signed tokens** that the sync server verifies
offline.

### Host key as a signed token

- At `/sync/hostKey` the sync server forwards the username and password to the auth service. This is the only
  call per login, and it is not per sync request.
- The auth service verifies the password and returns a host key shaped like a JWT or a PASETO v4 public token:
  `sub` (user id or email), `iat`, `exp`, `kid` (signing key id) and `ver` (the user's key version).
- It is signed with an **asymmetric** key (Ed25519). The auth service holds the private key. The sync server is
  configured with only the **public key** (or a JWKS URL).
- On every later request the sync server verifies the signature and `exp` locally and reads `sub`. There is no
  DB query and no network call. The sync server can validate a host key but can never mint one.

An HMAC with a shared secret would work too but lets the sync server forge host keys, so it is not preferred.

### Storage credentials

The `BackendResolver` asks the auth service for a short-lived Drive access token per sync session and caches it
until it expires. The refresh token and `TOKEN_ENCRYPTION_KEY` never leave the auth service.

### Who calls the sync server

- **Anki clients** send the host key to the sync server. That is the "verifying party" in the public-key check.
- The **REST API** keeps calling the sync server's sidecar (port 8081) with the internal token, as today.
  That direction does not change.

## Consequences

**Easier:**

- The sync server has no database dependency: no shared volume, and it can be a separate deployment.
- A compromised sync server cannot mint host keys or read refresh tokens.
- Sync keeps working through a short auth service outage: host keys verify offline and access tokens are cached.
- Only the `AuthProvider` and `BackendResolver` implementations in `sync-platform-cloud` change. The
  `sync-platform-api` traits (ADR 0014 in `anki-cloud-sync`) already isolate the fork.

**Harder:**

- **Revocation.** A signed token stays valid until `exp`. Anki clients keep the host key for a long time and show
  a login prompt when it is rejected, so `exp` has to be long (weeks or months). Revoking a user sooner needs a
  `ver` claim checked against a small cached list from the auth service, or signing-key rotation, which logs
  everyone out.
- **Token size.** A JWT is around 250 characters, longer than a SHA-1 hex string. Anki clients should accept
  this because they treat it as opaque, but it must be verified on desktop, AnkiDroid and AnkiMobile.
- **Key management.** The signing key needs rotation (`kid`), backup and secure storage.
- **Login depends on the auth service.** A first sync or a rejected host key needs it. Cached tokens cover only
  already-logged-in clients.
- It also replaces the weak `SHA1("user:password")` host key, which is a fast hash of the password stored in the
  DB.

## Alternatives considered

- **Keep the shared SQLite file** (the MVP choice): simplest, but single host and no isolation.
- **Shared network database** (Postgres or Turso): removes the single-node limit. Column grants can limit what
  the sync server reads, but it still needs the encryption key to use refresh tokens.
- **Sync server calls the REST API per request**: rejected, see above.
