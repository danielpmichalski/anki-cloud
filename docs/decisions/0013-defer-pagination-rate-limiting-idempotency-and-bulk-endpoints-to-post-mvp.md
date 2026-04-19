# 13. Defer pagination, rate limiting, idempotency keys, and bulk endpoints to post-MVP

Date: 2026-04-19

## Status

Accepted

## Context

[ADR-0008](./0008-use-hono-on-bun-for-rest-api-and-mcp-server.md) established the REST API
stack. The initial API design principles (captured in CLAUDE.md §6) listed cursor-based
pagination, per-API-key rate limiting, idempotency keys, and bulk card endpoints as
requirements. These were included as aspirational design goals at architecture time, before
the MVP scope was validated.

During M03 (REST API milestone) implementation, the following endpoints were built and
shipped:

- Full CRUD for decks, notes, cards, note types
- `GET /v1/cards/search` with Anki search syntax
- `GET/POST /v1/me/sync-password` and `POST /v1/me/sync-password/reset`
- API key management (`GET/POST/DELETE /v1/me/api-keys`)
- Storage configuration (`GET/PUT /v1/me/storage`)

The features below were **not implemented**:

| Feature                                    | Reason deferred                                                                                         |
|--------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Cursor-based pagination on list endpoints  | MVP data volumes are small; complexity not justified yet                                                |
| Rate limiting (Redis, 429 + `Retry-After`) | No abuse surface until public launch; add before opening to untrusted API keys                          |
| `Idempotency-Key` header on POST endpoints | No known clients require it at MVP; adds state management overhead                                      |
| `POST /v1/cards/bulk`                      | MCP `create_notes_bulk` tool can loop `POST /v1/decks/{id}/notes`; optimize when throughput data exists |

## Decision

Defer all four features to a post-MVP milestone. They are not prerequisites for the core
workflow (LLM → MCP → REST API → GDrive) to function correctly.

Implement them before a public, multi-tenant launch:

- **Pagination** — when list endpoints return more than a few hundred items in practice
- **Rate limiting** — before opening API key issuance to untrusted users
- **Idempotency keys** — if SDK clients or MCP retry logic requires them
- **Bulk endpoint** — if benchmarking shows loop-based bulk creation is a bottleneck

## Consequences

**Easier:**

- M03 ships without accidental scope creep
- No Redis dependency for rate limiting at MVP (Redis is still used for sync sessions)
- List endpoints remain simple; no cursor token serialization

**Harder:**

- List endpoints will need breaking changes or a new version when pagination is added
- Without rate limiting, the API is not safe to expose to untrusted API key holders at scale
- CLAUDE.md §6 API design principles overstate MVP scope; this ADR is the correction
