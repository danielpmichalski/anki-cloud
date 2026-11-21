// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startHttpServer } from "./http.js";
import { createServer } from "./server.js";

// MCP_TRANSPORT=http serves Streamable HTTP with a per-request bearer key; the default is stdio for local use.
if (process.env["MCP_TRANSPORT"] === "http") {
  startHttpServer(Number(process.env["MCP_PORT"] ?? 3001));
} else {
  await createServer().connect(new StdioServerTransport());
}
