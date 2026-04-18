import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

export default {
  port: Number.parseInt(process.env.PORT ?? "3000"),
  fetch: app.fetch,
};
