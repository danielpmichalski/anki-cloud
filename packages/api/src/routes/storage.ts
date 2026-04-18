import {
  ArcticFetchError,
  Google,
  OAuth2RequestError,
  generateCodeVerifier,
  generateState,
} from "arctic";
import { and, eq } from "drizzle-orm";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { db, storageConnections } from "@anki-cloud/db";
import { encrypt } from "@anki-cloud/db/encrypt";
import { authMiddleware } from "@/middleware/auth";
import type { Env } from "@/types";

const googleDrive = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_DRIVE_REDIRECT_URI!
);

const OAUTH_STATE_MAX_AGE = 600;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "/";

const ErrorSchema = z.object({ error: z.string(), code: z.string() });

const ProviderSchema = z.enum(["gdrive", "dropbox", "s3"]);

const StorageConnectionSchema = z.object({
  id: z.string().uuid(),
  provider: ProviderSchema,
  folderPath: z.string(),
  connectedAt: z.string().datetime(),
});

const StorageListResponseSchema = z.object({
  connections: z.array(StorageConnectionSchema),
});

const StorageConnectRequestSchema = z.object({
  provider: ProviderSchema,
});

const StorageConnectResponseSchema = z.object({
  redirectUrl: z.string().url(),
});

export const storageRouter = new OpenAPIHono<Env>();

const storageConnectRoute = createRoute({
  method: "post",
  path: "/me/storage/connect",
  middleware: [authMiddleware] as const,
  request: {
    body: {
      content: { "application/json": { schema: StorageConnectRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: StorageConnectResponseSchema } },
      description: "OAuth redirect URL to initiate storage connection",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unsupported provider",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

storageRouter.openapi(storageConnectRoute, async (c) => {
  const { provider } = c.req.valid("json");

  if (provider !== "gdrive") {
    return c.json({ error: "Provider not yet supported", code: "UNSUPPORTED_PROVIDER" }, 400);
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleDrive.createAuthorizationURL(state, codeVerifier, [
    "https://www.googleapis.com/auth/drive.file",
  ]);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  setCookie(c, "gdrive_oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  setCookie(c, "gdrive_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  return c.json({ redirectUrl: url.toString() }, 200);
});

const storageDisconnectRoute = createRoute({
  method: "delete",
  path: "/me/storage/{provider}",
  middleware: [authMiddleware] as const,
  request: {
    params: z.object({ provider: ProviderSchema }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      description: "Storage disconnected",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Storage connection not found",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

storageRouter.openapi(storageDisconnectRoute, async (c) => {
  const { id: userId } = c.get("user");
  const { provider } = c.req.valid("param");

  const deleted = await db
    .delete(storageConnections)
    .where(and(eq(storageConnections.userId, userId), eq(storageConnections.provider, provider)))
    .returning({ id: storageConnections.id });

  if (deleted.length === 0) {
    return c.json({ error: "Storage connection not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({ ok: true }, 200);
});

storageRouter.get("/me/storage/connect/gdrive", authMiddleware, async (c) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleDrive.createAuthorizationURL(state, codeVerifier, [
    "https://www.googleapis.com/auth/drive.file",
  ]);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  setCookie(c, "gdrive_oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  setCookie(c, "gdrive_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  return c.redirect(url.toString(), 302);
});

storageRouter.get("/me/storage/connect/gdrive/callback", authMiddleware, async (c) => {
  const { code, state } = c.req.query();
  const storedState = getCookie(c, "gdrive_oauth_state");
  const codeVerifier = getCookie(c, "gdrive_code_verifier");

  deleteCookie(c, "gdrive_oauth_state");
  deleteCookie(c, "gdrive_code_verifier");

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return c.redirect(`${FRONTEND_URL}?storage=error`, 302);
  }

  const { id: userId } = c.get("user");

  let tokens;
  try {
    tokens = await googleDrive.validateAuthorizationCode(code, codeVerifier);
  } catch (e) {
    if (e instanceof OAuth2RequestError || e instanceof ArcticFetchError) {
      return c.redirect(`${FRONTEND_URL}?storage=error`, 302);
    }
    throw e;
  }

  const accessToken = tokens.accessToken();
  const refreshToken = tokens.refreshToken();

  const [encryptedAccess, encryptedRefresh] = await Promise.all([
    encrypt(accessToken),
    encrypt(refreshToken),
  ]);

  await db
    .insert(storageConnections)
    .values({
      userId,
      provider: "gdrive",
      oauthToken: encryptedAccess,
      oauthRefreshToken: encryptedRefresh,
    })
    .onConflictDoUpdate({
      target: [storageConnections.userId, storageConnections.provider],
      set: {
        oauthToken: encryptedAccess,
        oauthRefreshToken: encryptedRefresh,
        connectedAt: new Date(),
      },
    });

  return c.redirect(`${FRONTEND_URL}?storage=connected`, 302);
});

const storageListRoute = createRoute({
  method: "get",
  path: "/me/storage",
  middleware: [authMiddleware] as const,
  responses: {
    200: {
      content: { "application/json": { schema: StorageListResponseSchema } },
      description: "Storage connections",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

storageRouter.openapi(storageListRoute, async (c) => {
  const { id: userId } = c.get("user");
  const connections = await db
    .select({
      id: storageConnections.id,
      provider: storageConnections.provider,
      folderPath: storageConnections.folderPath,
      connectedAt: storageConnections.connectedAt,
    })
    .from(storageConnections)
    .where(eq(storageConnections.userId, userId));

  return c.json(
    {
      connections: connections.map((conn) => ({
        ...conn,
        connectedAt: conn.connectedAt.toISOString(),
      })),
    },
    200
  );
});
