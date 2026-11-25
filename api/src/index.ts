// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { auth } from "@/auth";
import { authRouter } from "@/routes/auth";
import { storageRouter } from "@/routes/storage";
import { apiKeysRouter } from "@/routes/api-keys";
import { syncCredentialsRouter } from "@/routes/sync-credentials";
import { decksRouter } from "@/routes/decks";
import { notesRouter } from "@/routes/notes";
import { noteTypesRouter } from "@/routes/note-types";
import { cardsRouter } from "@/routes/cards";
import { reviewRouter } from "@/routes/review";
import { mediaRouter } from "@/routes/media";
import { uploadRouter } from "@/routes/upload";
import { authApiMiddleware } from "@/middleware/auth";
import type { Env } from "@/types";

// Public REST API — spec published at /openapi.json + /docs
const publicApi = new OpenAPIHono<Env>();
publicApi.route("/v1", decksRouter);
publicApi.route("/v1", notesRouter);
publicApi.route("/v1", noteTypesRouter);
publicApi.route("/v1", cardsRouter);
publicApi.route("/v1", reviewRouter);
publicApi.route("/v1", mediaRouter);

publicApi.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "http",
  scheme: "bearer",
  description: "API key generated via POST /v1/me/api-keys (format: ak_...)",
});

publicApi.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "anki-cloud API", version: "2.1.0" },
  security: [{ ApiKeyAuth: [] }],
});

publicApi.get("/docs", (c) =>
  c.html(`<!doctype html>
<html>
<head><title>anki-cloud API Reference</title></head>
<body>
<script id="api-reference" data-url="/openapi.json"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`)
);

// Main app — mounts public API + web UI routes (no spec)
const app = new OpenAPIHono<Env>();

// Browser-based OAuth clients (e.g. MCP Inspector) call discovery, registration and token endpoints directly.
// No credentials are allowed, so cookies never ride along cross-origin.
const oauthCors = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "MCP-Protocol-Version"],
  maxAge: 86400,
});
app.use("/.well-known/*", oauthCors);
app.use("/v1/auth/mcp/*", oauthCors);
app.use("/v1/whoami", oauthCors);

app.get("/health", (c) => c.json({ status: "ok" }));
app.on(["POST", "GET"], "/v1/auth/*", (c) => auth.handler(c.req.raw));
// RFC 8414 discovery lives at the issuer's origin root, outside the /v1/auth base path.
app.get("/.well-known/oauth-authorization-server", async (c) =>
  c.json(await auth.api.getMcpOAuthConfig({ headers: c.req.raw.headers })));
// Cheap credential check for the MCP server: 200 for a valid ak_ key or OAuth token, 401 otherwise.
app.get("/v1/whoami", authApiMiddleware, (c) => c.json(c.get("user")));
app.route("/", publicApi);
app.route("/", uploadRouter);
app.route("/v1", authRouter);
app.route("/v1", storageRouter);
app.route("/v1", apiKeysRouter);
app.route("/v1", syncCredentialsRouter);

app.onError((err, c) => {
  const status = (err as { status?: number }).status;
  if (status === 404) return c.json({ error: "not found", code: "NOT_FOUND" }, 404);
  if (status === 409) return c.json({ error: "sync in progress", code: "SYNC_IN_PROGRESS" }, 409);
  if (status !== undefined) return c.json({ error: "upstream error", code: "UPSTREAM_ERROR" }, 502);
  return c.json({ error: "internal error", code: "INTERNAL_ERROR" }, 500);
});

export default {
  port: Number.parseInt(process.env.PORT ?? "3000"),
  idleTimeout: 120,
  fetch: app.fetch,
};
