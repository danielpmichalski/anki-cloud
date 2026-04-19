// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono } from "@hono/zod-openapi";
import { authRouter } from "@/routes/auth";
import { storageRouter } from "@/routes/storage";
import { apiKeysRouter } from "@/routes/api-keys";
import { syncCredentialsRouter } from "@/routes/sync-credentials";
import { decksRouter } from "@/routes/decks";
import { notesRouter } from "@/routes/notes";
import { cardsRouter } from "@/routes/cards";
import type { Env } from "@/types";

// Public REST API — spec published at /openapi.json + /docs
const publicApi = new OpenAPIHono<Env>();
publicApi.route("/v1", decksRouter);
publicApi.route("/v1", notesRouter);
publicApi.route("/v1", cardsRouter);

publicApi.doc("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "anki-cloud API", version: "0.1.0" },
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

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/", publicApi);
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
  fetch: app.fetch,
};
