// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { authApiMiddleware } from "@/middleware/auth";
import { htmlSnippet } from "@/lib/media";
import { sidecar } from "@/lib/sidecar";
import type { Variables } from "@/types";

// Handlers can rely on `email` being set by requireEmail.
type MediaEnv = { Variables: Variables & { email: string } };
type Ctx = Context<MediaEnv>;

/** Sidecar calls are keyed by the account email; reject accounts without one. */
const requireEmail = createMiddleware<MediaEnv>(async (c, next) => {
  const { email } = c.get("user");
  if (!email) return c.json({ error: "no email on account" }, 401);
  c.set("email", email);
  await next();
});

const auth = [authApiMiddleware, requireEmail];

const ErrorSchema = z.object({ error: z.string() });

const StoredMediaSchema = z.object({
  name: z.string().openapi({ description: "Stored name. Anki lowercases and may rename (e.g. name-<hash>.png), so always use this one." }),
  added: z.boolean().openapi({ description: "false when an identical file was already stored" }),
  mimeType: z.string().openapi({
    description: "Type detected from the file's bytes (the file name and the client's Content-Type are ignored). One of image/png, image/jpeg, image/gif, image/webp, image/svg+xml, audio/mpeg, audio/ogg, audio/wav, audio/mp4, audio/3gpp, audio/amr.",
    example: "image/png",
  }),
  size: z.number().int().openapi({
    description: "Stored size in bytes. For SVG this is the size after sanitising, so it can be smaller than what was sent.",
    example: 20480,
  }),
  html: z.string().openapi({ description: "Snippet to paste into a note field", example: '<img src="cat.png">' }),
});

const MediaMetadataSchema = z.object({
  name: z.string(),
  mimeType: z.string().openapi({ description: "Type detected from the file's bytes", example: "image/png" }),
  size: z.number().int().openapi({ description: "Size in bytes", example: 20480 }),
  width: z.number().int().nullable().openapi({ description: "Pixel width; null for audio and SVG", example: 640 }),
  height: z.number().int().nullable().openapi({ description: "Pixel height; null for audio and SVG", example: 480 }),
});

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  cursor: z.string().optional(),
});

const errors = {
  400: { content: { "application/json": { schema: ErrorSchema } }, description: "Bad file (empty, invalid SVG, missing name)" },
  401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
  413: { content: { "application/json": { schema: ErrorSchema } }, description: "File too large" },
  415: { content: { "application/json": { schema: ErrorSchema } }, description: "File type not allowed" },
  502: { content: { "application/json": { schema: ErrorSchema } }, description: "Storage failed; the file was not stored" },
};

const SVG_MAX_BYTES = 200 * 1024;

/** Map a failed sidecar response to our error shape; null when it was ok. */
async function sidecarFailure(c: Ctx, res: Response): Promise<Response | null> {
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const status = [400, 404, 413, 415].includes(res.status) ? res.status : 502;
  return c.json({ error: body.error ?? (status === 502 ? "storage error" : "media error") }, status as never);
}

async function store(c: Ctx, email: string, name: string, data: Uint8Array) {
  const res = await sidecar.addMedia(email, name, data);
  const failure = await sidecarFailure(c, res);
  if (failure) return failure;
  const r = (await res.json()) as { name: string; added: boolean; mimeType: string; size: number };
  return c.json({ ...r, html: htmlSnippet(r.name, r.mimeType) }, res.status === 201 ? 201 : 200);
}

export const mediaRouter = new OpenAPIHono<MediaEnv>();

const storedResponses = {
  200: { content: { "application/json": { schema: StoredMediaSchema } }, description: "An identical file was already stored" },
  201: { content: { "application/json": { schema: StoredMediaSchema } }, description: "Stored" },
  ...errors,
};

// POST /media (multipart, one file per request)
mediaRouter.openapi(
  createRoute({
    method: "post",
    path: "/media",
    middleware: auth,
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object({
              file: z.any().openapi({ type: "string", format: "binary" }),
              name: z.string().optional().openapi({ description: "Desired file name; defaults to the uploaded file name" }),
            }),
          },
        },
        required: true,
      },
    },
    responses: storedResponses,
  }),
  async (c) => {
    const email = c.get("email");
    const form = c.req.valid("form") as { file?: unknown; name?: string };
    const file = form.file;
    if (!(file instanceof File)) return c.json({ error: "missing file" }, 400 as never);
    const name = form.name || file.name;
    if (!name) return c.json({ error: "missing file name" }, 400 as never);
    return await store(c, email, name, new Uint8Array(await file.arrayBuffer())) as never;
  }
);

// POST /media/svg (SVG as a JSON string, no base64)
mediaRouter.openapi(
  createRoute({
    method: "post",
    path: "/media/svg",
    middleware: auth,
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().min(1).openapi({ example: "diagram.svg" }),
              content: z.string().min(1).openapi({ description: "SVG markup (sanitised on the server)" }),
            }),
          },
        },
        required: true,
      },
    },
    responses: storedResponses,
  }),
  async (c) => {
    const email = c.get("email");
    const { name, content } = c.req.valid("json");
    const data = new TextEncoder().encode(content);
    if (data.length > SVG_MAX_BYTES) {
      return c.json({ error: "text too large (max 200 KB); use an upload link or multipart upload" }, 413 as never);
    }
    return await store(c, email, name, data) as never;
  }
);

// GET /media
mediaRouter.openapi(
  createRoute({
    method: "get",
    path: "/media",
    middleware: auth,
    request: { query: PaginationQuery },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              files: z.array(z.object({ name: z.string(), size: z.number().int() })),
              nextCursor: z.string().nullable(),
            }),
          },
        },
        description: "Media files in the collection",
      },
      ...errors,
    },
  }),
  async (c) => {
    const email = c.get("email");
    const { limit, cursor } = c.req.valid("query");
    const res = await sidecar.listMedia(email, { limit, cursor });
    const failure = await sidecarFailure(c, res);
    if (failure) return failure as never;
    const d = (await res.json()) as { files: { name: string; size: number }[]; nextCursor?: string | null };
    return c.json({ files: d.files, nextCursor: d.nextCursor ?? null }, 200);
  }
);

// GET /media/{name}/metadata
mediaRouter.openapi(
  createRoute({
    method: "get",
    path: "/media/{name}/metadata",
    middleware: auth,
    request: { params: z.object({ name: z.string() }) },
    responses: {
      200: { content: { "application/json": { schema: MediaMetadataSchema } }, description: "Facts about the file" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      ...errors,
    },
  }),
  async (c) => {
    const email = c.get("email");
    const res = await sidecar.getMediaMetadata(email, c.req.valid("param").name);
    const failure = await sidecarFailure(c, res);
    if (failure) return failure as never;
    return c.json((await res.json()) as z.infer<typeof MediaMetadataSchema>, 200);
  }
);

// GET /media/{name}
mediaRouter.openapi(
  createRoute({
    method: "get",
    path: "/media/{name}",
    middleware: auth,
    request: { params: z.object({ name: z.string() }) },
    responses: {
      200: { content: { "application/octet-stream": { schema: z.any().openapi({ type: "string", format: "binary" }) } }, description: "File bytes with the sniffed Content-Type" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      ...errors,
    },
  }),
  async (c) => {
    const email = c.get("email");
    const res = await sidecar.getMedia(email, c.req.valid("param").name);
    const failure = await sidecarFailure(c, res);
    if (failure) return failure as never;
    const headers = new Headers();
    for (const h of ["content-type", "x-content-type-options", "content-security-policy"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(await res.arrayBuffer(), { status: 200, headers }) as never;
  }
);

// DELETE /media/{name}
mediaRouter.openapi(
  createRoute({
    method: "delete",
    path: "/media/{name}",
    middleware: auth,
    request: { params: z.object({ name: z.string() }) },
    responses: {
      204: { description: "Deleted (propagates to clients on their next sync)" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
      ...errors,
    },
  }),
  async (c) => {
    const email = c.get("email");
    const res = await sidecar.deleteMedia(email, c.req.valid("param").name);
    const failure = await sidecarFailure(c, res);
    if (failure) return failure as never;
    return c.body(null, 204);
  }
);
