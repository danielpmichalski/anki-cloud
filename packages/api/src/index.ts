import { OpenAPIHono } from "@hono/zod-openapi";
import { authRouter } from "@/routes/auth";
import { storageRouter } from "@/routes/storage";
import type { Env } from "@/types";

const app = new OpenAPIHono<Env>();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/v1", authRouter);
app.route("/v1", storageRouter);

export default {
  port: Number.parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
};
