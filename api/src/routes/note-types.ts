// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { authApiMiddleware } from "@/middleware/auth";
import { sidecar } from "@/lib/sidecar";
import type { Env } from "@/types";

const ErrorSchema = z.object({ error: z.string() });

const NoteTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(z.string()),
});

export const noteTypesRouter = new OpenAPIHono<Env>();

// GET /note-types
noteTypesRouter.openapi(
  createRoute({
    method: "get",
    path: "/note-types",
    middleware: [authApiMiddleware] as const,
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ noteTypes: z.array(NoteTypeSchema) }),
          },
        },
        description: "List of note types",
      },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const data = await sidecar.listNoteTypes(rawEmail);
    return c.json(data, 200);
  }
);

// GET /note-types/:id
noteTypesRouter.openapi(
  createRoute({
    method: "get",
    path: "/note-types/{id}",
    middleware: [authApiMiddleware] as const,
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        content: { "application/json": { schema: NoteTypeSchema } },
        description: "Note type",
      },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
    },
  }),
  async (c) => {
    const { email: rawEmail } = c.get("user");
    if (!rawEmail) return c.json({ error: "no email on account" }, 401 as never);
    const { id } = c.req.valid("param");
    const noteType = await sidecar.getNoteType(rawEmail, id);
    return c.json(noteType, 200);
  }
);
