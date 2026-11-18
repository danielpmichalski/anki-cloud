// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { authApiMiddleware } from "@/middleware/auth";
import { sidecar } from "@/lib/sidecar";
import type { Env } from "@/types";

const ErrorSchema = z.object({ error: z.string() });

const CountsSchema = z.object({
  new: z.number().int(),
  learning: z.number().int(),
  review: z.number().int(),
});

const ReviewCardSchema = z.object({
  cardId: z.string(),
  noteId: z.string(),
  deck: z.string(),
  state: z.enum(["new", "learning", "review"]),
  tags: z.array(z.string()),
  question: z.string().describe("Rendered question side as plain text"),
  answer: z.string().describe("Rendered answer side as plain text (without the question)"),
  nextIntervals: z
    .object({
      again: z.string().nullable(),
      hard: z.string().nullable(),
      good: z.string().nullable(),
      easy: z.string().nullable(),
    })
    .describe("When the card comes back for each rating, e.g. '10m', '3d'"),
});

const DeckQuery = z.object({ deckId: z.string().regex(/^\d+$/, "deckId must be numeric") });

export const reviewRouter = new OpenAPIHono<Env>();

// GET /review/next?deckId=&limit=
// Returns the next scheduled cards in Anki's own order. Cards are NOT consumed by reading:
// call POST /review/answer for each card, then call this again for the next batch.
reviewRouter.openapi(
  createRoute({
    method: "get",
    path: "/review/next",
    middleware: [authApiMiddleware] as const,
    request: {
      query: DeckQuery.extend({
        limit: z.coerce.number().int().min(1).max(20).optional().default(5),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ cards: z.array(ReviewCardSchema), counts: CountsSchema }),
          },
        },
        description: "Next scheduled cards (at most 20) and the remaining due counts for the deck",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Deck or card not found" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { deckId, limit } = c.req.valid("query");
    const data = await sidecar.reviewNext(rawEmail, deckId, limit);
    return c.json(data, 200);
  }
);

// GET /review/counts?deckId=
reviewRouter.openapi(
  createRoute({
    method: "get",
    path: "/review/counts",
    middleware: [authApiMiddleware] as const,
    request: { query: DeckQuery },
    responses: {
      200: {
        content: { "application/json": { schema: CountsSchema } },
        description: "How many new / learning / review cards are due in the deck",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Deck or card not found" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { deckId } = c.req.valid("query");
    const data = await sidecar.reviewCounts(rawEmail, deckId);
    return c.json(data, 200);
  }
);

// POST /review/answer
reviewRouter.openapi(
  createRoute({
    method: "post",
    path: "/review/answer",
    middleware: [authApiMiddleware] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              cardId: z.string().regex(/^\d+$/, "cardId must be numeric"),
              rating: z.enum(["again", "hard", "good", "easy"]),
              millisecondsTaken: z.number().int().min(0).max(3_600_000).optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
              next: z.string().nullable().describe("When the card is due again, e.g. '10m', '3d'"),
            }),
          },
        },
        description: "Answer recorded; the card is rescheduled by the scheduler",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Deck or card not found" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const body = c.req.valid("json");
    const data = await sidecar.reviewAnswer(rawEmail, body);
    return c.json(data, 200);
  }
);
