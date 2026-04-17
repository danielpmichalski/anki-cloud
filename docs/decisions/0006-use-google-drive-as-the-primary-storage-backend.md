# 6. Use Google Drive as the primary storage backend

Date: 2026-04-17

## Status

Accepted

## Context

[ADR-0002](./0002-use-user-owned-cloud-storage-for-deck-data.md) establishes that deck data lives in user-owned cloud storage. Multiple backends are planned (Google Drive, Dropbox, S3-compatible, OneDrive). A single backend must be chosen for MVP to de-risk the storage adapter implementation before investing in multiple providers.

Google Drive is the most widely used personal cloud storage among the target audience. It shares the same OAuth2 infrastructure already established in [ADR-0004](./0004-use-oauth2-for-authentication-no-password-storage.md) and [ADR-0005](./0005-use-google-as-the-sole-oauth-provider-mvp.md), reducing initial integration complexity — a single Google OAuth app covers both identity and storage consent.

## Decision

Google Drive is the sole supported storage backend for MVP. Deck data is written to a dedicated `/AnkiSync/` folder in the user's Drive using the `drive.file` scope (minimal — access only to files created by the app). Additional backends (Dropbox, S3, OneDrive) follow in later milestones once the adapter interface is proven.

## Consequences

**Easier:**
- Single OAuth2 app covers both identity and storage — fewer moving parts at MVP
- `drive.file` scope limits blast radius of token compromise
- Large existing user base already has Google accounts

**Harder:**
- GDrive API has rate limits and quota constraints — heavy sync users may hit them
- Media files (large audio/images) add latency and quota pressure
- Users without Google accounts blocked until additional backends ship
- This ADR will be superseded when Dropbox/S3/OneDrive support is added
