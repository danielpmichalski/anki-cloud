// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { authMiddleware } from "@/middleware/auth";
import { sidecar } from "@/lib/sidecar";
import type { Env } from "@/types";

const ErrorSchema = z.object({ error: z.string() });

const DeckSchema = z.object({
  id: z.string(),
  name: z.string(),
});

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

export const decksRouter = new OpenAPIHono<Env>();

// GET /decks
decksRouter.openapi(
  createRoute({
    method: "get",
    path: "/decks",
    middleware: [authMiddleware] as const,
    request: { query: PaginationQuery },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ decks: z.array(DeckSchema), nextCursor: z.string().nullable() }),
          },
        },
        description: "List of decks",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { limit, cursor } = c.req.valid("query");
    const data = await sidecar.listDecks(rawEmail, { limit, cursor });
    return c.json(data, 200);
  }
);

// POST /decks
decksRouter.openapi(
  createRoute({
    method: "post",
    path: "/decks",
    middleware: [authMiddleware] as const,
    request: {
      headers: IdempotencyHeader,
      body: {
        content: { "application/json": { schema: z.object({ name: z.string().min(1) }) } },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: DeckSchema } },
        description: "Created deck",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { name } = c.req.valid("json");
    const deck = await sidecar.createDeck(rawEmail, name);
    return c.json(deck, 201);
  }
);

// GET /decks/:id
decksRouter.openapi(
  createRoute({
    method: "get",
    path: "/decks/{id}",
    middleware: [authMiddleware] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        content: { "application/json": { schema: DeckSchema } },
        description: "Deck",
      },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const deck = await sidecar.getDeck(rawEmail, id);
    return c.json(deck, 200);
  }
);

// DELETE /decks/:id
decksRouter.openapi(
  createRoute({
    method: "delete",
    path: "/decks/{id}",
    middleware: [authMiddleware] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
        description: "Deleted",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const result = await sidecar.deleteDeck(rawEmail, id);
    return c.json(result, 200);
  }
);

// GET /decks/:id/notes
decksRouter.openapi(
  createRoute({
    method: "get",
    path: "/decks/{id}/notes",
    middleware: [authMiddleware] as const,
    request: {
      params: z.object({ id: z.string() }),
      query: PaginationQuery,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ notes: z.array(NoteSchema), nextCursor: z.string().nullable() }),
          },
        },
        description: "Notes in deck",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const { limit, cursor } = c.req.valid("query");
    const data = await sidecar.listNotes(rawEmail, id, { limit, cursor });
    return c.json(data, 200);
  }
);

// POST /decks/:id/notes
decksRouter.openapi(
  createRoute({
    method: "post",
    path: "/decks/{id}/notes",
    middleware: [authMiddleware] as const,
    request: {
      params: z.object({ id: z.string() }),
      headers: IdempotencyHeader,
      body: {
        content: {
          "application/json": {
            schema: z.object({
              fields: z.record(z.string()),
              tags: z.array(z.string()).optional(),
              noteTypeId: z.string().optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: z.object({ id: z.string() }) } },
        description: "Created note",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const note = await sidecar.createNote(rawEmail, id, body);
    return c.json(note, 201);
  }
);
