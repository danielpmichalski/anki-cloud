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

const app = new OpenAPIHono<Env>();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1", authRouter);
app.route("/v1", storageRouter);
app.route("/v1", apiKeysRouter);
app.route("/v1", syncCredentialsRouter);
app.route("/v1", decksRouter);
app.route("/v1", notesRouter);
app.route("/v1", cardsRouter);

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
