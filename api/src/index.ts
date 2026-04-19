// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono } from "@hono/zod-openapi";
import { authRouter } from "@/routes/auth";
import { storageRouter } from "@/routes/storage";
import { apiKeysRouter } from "@/routes/api-keys";
import { syncCredentialsRouter } from "@/routes/sync-credentials";
import { decksRouter } from "@/routes/decks";
import { notesRouter } from "@/routes/notes";
import type { Env } from "@/types";

const app = new OpenAPIHono<Env>();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1", authRouter);
app.route("/v1", storageRouter);
app.route("/v1", apiKeysRouter);
app.route("/v1", syncCredentialsRouter);
app.route("/v1", decksRouter);
app.route("/v1", notesRouter);

export default {
  port: Number.parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
};
