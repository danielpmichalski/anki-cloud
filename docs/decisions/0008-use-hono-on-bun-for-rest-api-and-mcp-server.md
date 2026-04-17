# 8. Use Hono on Bun for REST API and MCP server

Date: 2026-04-17

## Status

Accepted

## Context

The service requires a REST API layer ([ADR-0002](./0002-use-user-owned-cloud-storage-for-deck-data.md), [ADR-0004](./0004-use-oauth2-for-authentication-no-password-storage.md)) and an MCP server ([ADR-0007](./0007-mcp-server-wraps-rest-api-not-direct-db.md)). A runtime and framework must be chosen. The following options were evaluated:

| | FastAPI (Python) | Fastify (Node.js) | Hono (Bun) |
|---|---|---|---|
| **Raw throughput** | ~30k req/s | ~70k req/s | ~100k req/s |
| **Docker image** | ~250MB | ~180MB | ~90MB |
| **OpenAPI** | Auto-generated, near-zero boilerplate | Plugin, manual wiring | `@hono/zod-openapi`, explicit but fully type-safe |
| **Type safety** | Pydantic (runtime) | TypeBox/Zod | Zod (compile-time + runtime) |
| **MCP SDK** | Official Python SDK | — | Official TypeScript SDK (`@modelcontextprotocol/sdk`) |
| **Startup time** | Slow (Python import overhead) | Fast | Near-instant |

**FastAPI** was the initial default due to familiarity and excellent OpenAPI-native DX. Rejected because: Python runtime overhead, larger images, and the MCP TypeScript SDK is equally first-class — there is no language-cohesion advantage to Python.

**Fastify** was considered as a Node.js alternative. Rejected because Bun's runtime is significantly faster than Node.js and produces smaller images with no ecosystem sacrifice.

**Hono on Bun** wins on every production metric that matters: smallest image, fastest runtime, first-class OpenAPI via `@hono/zod-openapi`, end-to-end TypeScript type safety across REST API and MCP server, and near-instant cold starts.

## Decision

Use **Hono** as the web framework and **Bun** as the runtime for both the REST API and the MCP server. Both services share a single TypeScript monorepo (or workspace), sharing Zod schemas, auth utilities, and GDrive client code. OpenAPI spec is auto-generated via `@hono/zod-openapi` — Zod schemas are the single source of truth for request/response types.

## Consequences

**Easier:**
- Smallest Docker images (~90MB) — faster deploys, lower hosting costs
- Fastest runtime — headroom for traffic spikes without scaling
- End-to-end TypeScript: shared types between REST API and MCP server, no runtime type surprises
- Near-instant cold starts — better for self-hosters with low traffic
- Single runtime for two services — one Dockerfile base image, one toolchain

**Harder:**
- Bun is newer than Node.js — occasional compatibility gaps with npm packages (rare but possible)
- `@hono/zod-openapi` is more verbose than FastAPI's decorator approach — more boilerplate per route
- Team must be comfortable with TypeScript; Python familiarity doesn't transfer
- Rust (sync server) + TypeScript (API + MCP) is still a two-language stack
