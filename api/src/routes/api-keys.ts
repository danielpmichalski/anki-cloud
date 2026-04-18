import { and, eq, isNull } from "drizzle-orm";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db, usersApiKeys } from "@anki-cloud/db";
import { authMiddleware } from "@/middleware/auth";
import type { Env } from "@/types";

const ErrorSchema = z.object({ error: z.string(), code: z.string() });

const ApiKeySchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

const ApiKeyListResponseSchema = z.object({
  apiKeys: z.array(ApiKeySchema),
});

const CreateApiKeyRequestSchema = z.object({
  label: z.string().min(1).max(100),
});

const CreateApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  key: z.string(),
  createdAt: z.string().datetime(),
});

export const apiKeysRouter = new OpenAPIHono<Env>();

const listApiKeysRoute = createRoute({
  method: "get",
  path: "/me/api-keys",
  middleware: [authMiddleware] as const,
  responses: {
    200: {
      content: { "application/json": { schema: ApiKeyListResponseSchema } },
      description: "Active API keys",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

apiKeysRouter.openapi(listApiKeysRoute, async (c) => {
  const { id: userId } = c.get("user");

  const keys = await db
    .select({
      id: usersApiKeys.id,
      label: usersApiKeys.label,
      lastUsedAt: usersApiKeys.lastUsedAt,
      createdAt: usersApiKeys.createdAt,
    })
    .from(usersApiKeys)
    .where(and(eq(usersApiKeys.userId, userId), isNull(usersApiKeys.revokedAt)));

  return c.json(
    {
      apiKeys: keys.map((k) => ({
        ...k,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    },
    200
  );
});

const createApiKeyRoute = createRoute({
  method: "post",
  path: "/me/api-keys",
  middleware: [authMiddleware] as const,
  request: {
    body: {
      content: { "application/json": { schema: CreateApiKeyRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: CreateApiKeyResponseSchema } },
      description: "Created API key (plaintext shown once)",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

apiKeysRouter.openapi(createApiKeyRoute, async (c) => {
  const { id: userId } = c.get("user");
  const { label } = c.req.valid("json");

  const rawKey = `ak_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;
  const keyHash = await Bun.password.hash(rawKey, { algorithm: "bcrypt", cost: 10 });

  const [created] = await db
    .insert(usersApiKeys)
    .values({ userId, label, keyHash })
    .returning();

  return c.json(
    {
      id: created!.id,
      label: created!.label,
      key: rawKey,
      createdAt: created!.createdAt.toISOString(),
    },
    201
  );
});

const revokeApiKeyRoute = createRoute({
  method: "delete",
  path: "/me/api-keys/{id}",
  middleware: [authMiddleware] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      description: "API key revoked",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "API key not found",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

apiKeysRouter.openapi(revokeApiKeyRoute, async (c) => {
  const { id: userId } = c.get("user");
  const { id } = c.req.valid("param");

  const updated = await db
    .update(usersApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(usersApiKeys.id, id),
        eq(usersApiKeys.userId, userId),
        isNull(usersApiKeys.revokedAt)
      )
    )
    .returning({ id: usersApiKeys.id });

  if (updated.length === 0) {
    return c.json({ error: "API key not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({ ok: true }, 200);
});
