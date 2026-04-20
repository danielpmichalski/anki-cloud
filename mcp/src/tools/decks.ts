// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "../client.js";

export function registerDeckTools(server: McpServer): void {
  server.tool(
    "list_decks",
    "List all Anki decks in the user's collection. Returns deck IDs and names. " +
      "Use this to discover available decks before creating notes.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Maximum number of decks to return (default 100)"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous list_decks response"),
    },
    async ({ limit, cursor }) => {
      const data = await api.listDecks({ limit, cursor });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_deck",
    "Get details of a specific Anki deck by its ID.",
    {
      id: z.string().describe("The deck ID (e.g. from list_decks)"),
    },
    async ({ id }) => {
      const deck = await api.getDeck(id);
      return { content: [{ type: "text", text: JSON.stringify(deck, null, 2) }] };
    }
  );

  server.tool(
    "create_deck",
    "Create a new Anki deck. Returns the new deck's ID and name.",
    {
      name: z
        .string()
        .min(1)
        .describe(
          "Name for the new deck, e.g. 'Spanish Vocabulary' or 'Physics::Optics' (use :: for subdecks)"
        ),
    },
    async ({ name }) => {
      const deck = await api.createDeck(name);
      return { content: [{ type: "text", text: JSON.stringify(deck, null, 2) }] };
    }
  );
}
