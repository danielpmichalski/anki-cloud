# 5. Use Google as the sole OAuth provider (MVP)

Date: 2026-04-17

## Status

Accepted

## Context

[ADR-0004](./0004-use-oauth2-for-authentication-no-password-storage.md) establishes that the service uses OAuth2 exclusively. Multiple providers are technically possible (Google, Microsoft, GitHub, Apple). A single provider must be chosen for MVP to avoid multiplying integration complexity before the core product is proven.

Google is the dominant identity provider for the target audience. A single Google OAuth app covers both identity and storage consent screens, minimising the number of OAuth integrations needed at MVP.

## Decision

Google is the sole supported OAuth2 identity provider for MVP. Users sign in with Google only. The permanent `sub` field from Google's ID token is the primary user identifier in the database. Additional providers (Microsoft, GitHub, Apple) are added in later milestones by extending the auth layer without breaking existing accounts.

## Consequences

**Easier:**
- Single OAuth2 app covers all required scopes — fewer moving parts at MVP
- No per-provider adapter layer needed at MVP
- Google accounts ubiquitous among target audience

**Harder:**
- Users without Google accounts cannot register until additional providers ship
- Google account suspension or OAuth app revocation locks users out entirely
- This ADR will be superseded when additional OAuth providers are added
