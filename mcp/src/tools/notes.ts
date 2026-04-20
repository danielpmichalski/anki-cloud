// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "../client.js";

const NoteFieldsSchema = z.record(z.string()).describe(
  "Map of field name to value. The default Anki note type uses 'Front' and 'Back'. " +
    "Use search_notes to inspect existing notes and discover field names."
);

export function registerNoteTools(server: McpServer): void {
  server.tool(
    "create_note",
    "Add a single flashcard to an Anki deck. " +
      "The fields map must match the note type's field names — the default type uses 'Front' and 'Back'. " +
      "Returns the new note ID.",
    {
      deckId: z.string().describe("ID of the deck to add the note to"),
      fields: NoteFieldsSchema,
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional list of tags, e.g. ['python', 'chapter3']"),
      noteTypeId: z
        .string()
        .optional()
        .describe("Note type ID — omit to use the deck's default note type"),
    },
    async ({ deckId, fields, tags, noteTypeId }) => {
      const result = await api.createNote(deckId, { fields, tags, noteTypeId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_notes_bulk",
    "Add multiple flashcards to an Anki deck in a single request. " +
      "More efficient than calling create_note repeatedly when adding many cards. " +
      "Returns an array of created note IDs in the same order as the input.",
    {
      deckId: z.string().describe("ID of the deck to add the notes to"),
      notes: z
        .array(
          z.object({
            fields: NoteFieldsSchema,
            tags: z.array(z.string()).optional(),
            noteTypeId: z.string().optional(),
          })
        )
        .min(1)
        .describe("Array of notes to create"),
    },
    async ({ deckId, notes }) => {
      const result = await api.createNotesBulk(deckId, notes);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search_notes",
    "Search for notes using Anki's search syntax. " +
      "Examples: 'tag:python', 'deck:Spanish front:hola', 'added:7' (added in last 7 days). " +
      "Returns matching notes with their fields and tags.",
    {
      query: z
        .string()
        .min(1)
        .describe("Anki search query string, e.g. 'tag:python' or 'deck:MyDeck'"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Maximum number of notes to return (default 100)"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous search_notes response"),
    },
    async ({ query, limit, cursor }) => {
      const data = await api.searchNotes(query, { limit, cursor });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_note",
    "Edit an existing note's fields and/or tags. All fields are replaced, not merged. " +
      "Use search_notes to find the note ID and its current fields first.",
    {
      id: z.string().describe("The note ID to update"),
      fields: NoteFieldsSchema,
      tags: z
        .array(z.string())
        .optional()
        .describe("New tag list — replaces existing tags entirely"),
    },
    async ({ id, fields, tags }) => {
      const result = await api.updateNote(id, { fields, tags });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "delete_note",
    "Permanently delete a note and all cards generated from it. This cannot be undone.",
    {
      id: z.string().describe("The note ID to delete"),
    },
    async ({ id }) => {
      const result = await api.deleteNote(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
