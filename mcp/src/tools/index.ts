// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDeckTools } from "./decks.js";
import { registerNoteTools } from "./notes.js";

export function registerTools(server: McpServer): void {
  registerDeckTools(server);
  registerNoteTools(server);
}
