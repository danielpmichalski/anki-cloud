// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { registerTools } from "./tools/index.js";

// Release images set APP_VERSION from the git tag; local runs fall back to package.json.
export const VERSION = process.env["APP_VERSION"] || pkg.version;

export function createServer(): McpServer {
  const server = new McpServer({ name: "anki-cloud", version: VERSION });
  registerTools(server);
  return server;
}
