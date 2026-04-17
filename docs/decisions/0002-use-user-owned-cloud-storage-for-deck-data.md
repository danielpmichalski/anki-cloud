# 2. Use user-owned cloud storage for deck data

Date: 2026-04-17

## Status

Accepted

## Context

The service needs to persist user deck data (cards, notes, review history, media). Hosting this data ourselves introduces liability, GDPR complexity, storage costs, and requires users to trust a third-party with their learning data. If the service shuts down, users lose their data.

## Decision

Deck data is never stored on our servers. Users connect their own cloud storage (Google Drive, Dropbox, S3-compatible). The service writes deck data directly to the user's storage and reads from it on sync. Our database stores only OAuth tokens for accessing that storage — never the data itself.

## Consequences

**Easier:**
- No GDPR data liability for deck content
- No storage costs at scale
- User data survives service shutdown
- Clear privacy pitch: "Your cards live in your Google Drive. We just sync them."

**Harder:**
- Sync latency depends on third-party storage API performance
- Must handle OAuth token refresh, storage API rate limits, and quota errors
- Media files (audio/images) need special handling due to size and latency
- Conflict resolution when two devices sync simultaneously is the service's responsibility, not a DB transaction
