# 4. Use OAuth2 for authentication (no password storage)

Date: 2026-04-17

## Status

Accepted

## Context

The service requires user authentication. Traditional username/password auth introduces liability: passwords must be hashed, salted, and stored securely; breaches expose user credentials; users reuse passwords across services. Even "temporary" storage of plaintext credentials is a liability vector (logs, memory dumps, TTL bugs).

Additionally, the storage backend integration already requires OAuth2 tokens for accessing user cloud storage (per [ADR-0002](./0002-use-user-owned-cloud-storage-for-deck-data.md)). A unified OAuth2 approach avoids introducing a second auth mechanism.

## Decision

Users authenticate exclusively via OAuth2. No passwords are ever accepted, stored, or transmitted through the service. The OAuth2 `sub` field (a permanent, provider-issued unique user ID) is the primary user identifier stored in the database. The service issues its own session tokens (JWT or signed cookie) after the OAuth2 exchange completes — it never proxies OAuth tokens to clients.

API access uses scoped, revocable API keys (generated post-login in the web UI), not OAuth tokens directly.

## Consequences

**Easier:**
- Zero password storage liability — no breach surface for credentials
- Tokens are scoped and revocable by the user at any time
- Delegates identity verification to trusted providers (Google, future: Microsoft, GitHub)
- Complies with GDPR/SOC2 expectations without custom password handling

**Harder:**
- Users without a supported OAuth provider cannot register (acceptable for MVP)
- OAuth flow adds redirect round-trips — slightly more complex than a login form
- Token refresh logic must be handled correctly; expired tokens silently break sync
- This ADR will be extended (not superseded) when additional providers are added
