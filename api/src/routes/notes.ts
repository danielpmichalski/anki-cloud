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

export const notesRouter = new OpenAPIHono<Env>();

// GET /notes/search?q=
notesRouter.openapi(
  createRoute({
    method: "get",
    path: "/notes/search",
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
        description: "Search results",
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

// GET /notes/:id
notesRouter.openapi(
  createRoute({
    method: "get",
    path: "/notes/{id}",
    middleware: [authApiMiddleware] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        content: { "application/json": { schema: NoteSchema } },
        description: "Note",
      },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const note = await sidecar.getNote(rawEmail, id);
    return c.json(note, 200);
  }
);

// PUT /notes/:id
notesRouter.openapi(
  createRoute({
    method: "put",
    path: "/notes/{id}",
    middleware: [authApiMiddleware] as const,
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              fields: z.record(z.string()),
              tags: z.array(z.string()).optional().default([]),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
        description: "Updated",
      },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await sidecar.updateNote(rawEmail, id, body);
    return c.json(result, 200);
  }
);

// DELETE /notes/:id
notesRouter.openapi(
  createRoute({
    method: "delete",
    path: "/notes/{id}",
    middleware: [authApiMiddleware] as const,
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
    const result = await sidecar.deleteNote(rawEmail, id);
    return c.json(result, 200);
  }
);
