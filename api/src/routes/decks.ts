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

export const decksRouter = new OpenAPIHono<Env>();

// GET /decks
decksRouter.openapi(
  createRoute({
    method: "get",
    path: "/decks",
    middleware: [authMiddleware] as const,
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ decks: z.array(DeckSchema) }) } },
        description: "List of decks",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const email = rawEmail;
    const data = await sidecar.listDecks(email);
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
    const email = rawEmail;
    const { name } = c.req.valid("json");
    const deck = await sidecar.createDeck(email, name);
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
    const email = rawEmail;
    const { id } = c.req.valid("param");
    const deck = await sidecar.getDeck(email, id);
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
    const email = rawEmail;
    const { id } = c.req.valid("param");
    const result = await sidecar.deleteDeck(email, id);
    return c.json(result, 200);
  }
);

// GET /decks/:id/notes
decksRouter.openapi(
  createRoute({
    method: "get",
    path: "/decks/{id}/notes",
    middleware: [authMiddleware] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ notes: z.array(NoteSchema) }) } },
        description: "Notes in deck",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const email = rawEmail;
    const { id } = c.req.valid("param");
    const data = await sidecar.listNotes(email, id);
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
    const email = rawEmail;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const note = await sidecar.createNote(email, id, body);
    return c.json(note, 201);
  }
);
