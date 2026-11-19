// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "../client.js";

export function registerReviewTools(server: McpServer): void {
  server.tool(
    "get_review_counts",
    "How many new, learning and review cards are due in a deck right now. " +
      "Cheap: returns only three numbers, no card content. Use it to tell the user what a study session will look like.",
    {
      deckId: z.string().describe("The deck ID (from list_decks)"),
    },
    async ({ deckId }) => {
      const data = await api.getReviewCounts(deckId);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_due_cards",
    "Get the next scheduled flashcards to review in a deck, in the scheduler's own order. " +
      "Returns each card's cardId, rendered question and answer (plain text), state, and the interval each rating would give. " +
      "Reading does not consume cards: a card stays at the front of the queue until it is answered with answer_card. " +
      "Fetch only a few at a time (default 5, max 20) to keep the conversation small; after answering, call again for the next batch. " +
      "The 'answer' field is the correct answer: do NOT show it to the user before they have tried to answer.",
    {
      deckId: z.string().describe("The deck ID (from list_decks)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Number of cards to fetch (default 5, max 20)"),
    },
    async ({ deckId, limit }) => {
      const data = await api.getDueCards(deckId, limit);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "answer_card",
    "Record the user's review of a card, which reschedules it (spaced repetition). " +
      "Only call this AFTER the user has confirmed the grade: this changes their study history and is hard to undo. " +
      "Ratings: again (forgot / wrong), hard (correct but difficult), good (correct), easy (effortless).",
    {
      cardId: z.string().describe("The cardId from get_due_cards"),
      rating: z.enum(["again", "hard", "good", "easy"]).describe("The grade the user confirmed"),
      millisecondsTaken: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Optional: how long the user took to answer, in milliseconds"),
    },
    async ({ cardId, rating, millisecondsTaken }) => {
      const data = await api.answerCard({
        cardId,
        rating,
        ...(millisecondsTaken !== undefined ? { millisecondsTaken } : {}),
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
