// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./data/anki-cloud.db",
  },
  verbose: true,
  strict: true,
});
