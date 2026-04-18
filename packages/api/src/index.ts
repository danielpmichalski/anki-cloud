import { OpenAPIHono } from "@hono/zod-openapi";
import { authRouter } from "@/routes/auth";
import { storageRouter } from "@/routes/storage";
import { apiKeysRouter } from "@/routes/api-keys";
import { syncCredentialsRouter } from "@/routes/sync-credentials";
import type { Env } from "@/types";

const app = new OpenAPIHono<Env>();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1", authRouter);
app.route("/v1", storageRouter);
app.route("/v1", apiKeysRouter);
app.route("/v1", syncCredentialsRouter);

export default {
  port: Number.parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
};
