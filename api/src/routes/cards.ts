// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { authApiMiddleware } from "@/middleware/auth";
import { sidecar } from "@/lib/sidecar";
import type { Env } from "@/types";

const ErrorSchema = z.object({ error: z.string() });

const NoteSchema = z.object({
  id: z.string(),
  noteTypeId: z.string(),
  tags: z.array(z.string()),
  fields: z.record(z.string()),
});

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  cursor: z.string().optional(),
});

const IdempotencyHeader = z.object({
  "idempotency-key": z.string().optional(),
});

export const cardsRouter = new OpenAPIHono<Env>();

// GET /cards/search?q=
// Cards in Anki are generated from notes via templates. Anki search syntax is identical
// for notes and cards, so this endpoint proxies to notes search and returns note-shaped objects.
cardsRouter.openapi(
  createRoute({
    method: "get",
    path: "/cards/search",
    middleware: [authApiMiddleware] as const,
    request: {
      query: z.object({ q: z.string().min(1) }).merge(PaginationQuery),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ notes: z.array(NoteSchema), nextCursor: z.string().nullable() }),
          },
        },
        description: "Matching notes (cards are derived from notes via Anki note type templates)",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { q, limit, cursor } = c.req.valid("query");
    const data = await sidecar.searchNotes(rawEmail, q, { limit, cursor });
    return c.json(data, 200);
  }
);

// POST /cards/bulk
cardsRouter.openapi(
  createRoute({
    method: "post",
    path: "/cards/bulk",
    middleware: [authApiMiddleware] as const,
    request: {
      headers: IdempotencyHeader,
      body: {
        content: {
          "application/json": {
            schema: z.object({
              deckId: z.string(),
              notes: z.array(
                z.object({
                  fields: z.record(z.string()),
                  tags: z.array(z.string()).optional(),
                  noteTypeId: z.string().optional(),
                })
              ).min(1),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: z.object({ ids: z.array(z.string()) }) } },
        description: "Created note IDs",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { deckId, notes } = c.req.valid("json");
    const result = await sidecar.createNotesBulk(rawEmail, deckId, notes);
    return c.json(result, 201);
  }
);
