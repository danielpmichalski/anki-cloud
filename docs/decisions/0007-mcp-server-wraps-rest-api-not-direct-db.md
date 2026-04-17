# 7. MCP server wraps REST API, not direct DB

Date: 2026-04-17

## Status

Accepted

## Context

The MCP server exposes Anki operations as tools for LLM clients. It needs access to deck and note data. Two implementation paths exist:

1. **Direct DB access** — MCP server reads/writes SQLite and cloud storage directly
2. **REST API wrapper** — MCP server calls the REST API, which owns all business logic

The REST API is the primary interface for all external integrations ([ADR-0004](./0004-use-oauth2-for-authentication-no-password-storage.md) establishes API key auth that both paths would use).

## Decision

The MCP server is a thin wrapper over the REST API. It translates MCP tool calls into REST API requests and returns the responses. It contains no business logic, no direct DB access, and no storage adapter code.

## Consequences

**Easier:**
- Single source of truth for business logic — REST API changes propagate to MCP automatically
- Auth, rate limiting, validation all handled once in the REST layer
- MCP server is trivially testable by mocking the REST API
- REST API and MCP server can be deployed and scaled independently
- Community can build alternative MCP servers or other clients against the same REST API

**Harder:**
- Every MCP tool call incurs an HTTP round-trip to the REST API — adds latency
- Two services to deploy and keep running instead of one
- REST API must be running for MCP to function — adds an operational dependency
