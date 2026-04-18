import {
  ArcticFetchError,
  Google,
  OAuth2RequestError,
  decodeIdToken,
  generateCodeVerifier,
  generateState,
} from "arctic";
import { eq } from "drizzle-orm";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SignJWT } from "jose";
import { db, users } from "@anki-cloud/db";
import { authMiddleware } from "@/middleware/auth";
import type { Env } from "@/types";

const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI!
);

const secret = new Uint8Array(Buffer.from(process.env.JWT_SECRET!, "hex"));

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

const ErrorSchema = z.object({ error: z.string(), code: z.string() });

const MeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const FRONTEND_URL = process.env.FRONTEND_URL ?? "/";

export const authRouter = new OpenAPIHono<Env>();

authRouter.get("/auth/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.redirect(FRONTEND_URL, 302);
});

authRouter.get("/auth/google", async (c) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);

  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  setCookie(c, "oauth_code_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  return c.redirect(url.toString(), 302);
});

authRouter.get("/auth/google/callback", async (c) => {
  const { code, state } = c.req.query();
  const storedState = getCookie(c, "oauth_state");
  const codeVerifier = getCookie(c, "oauth_code_verifier");

  deleteCookie(c, "oauth_state");
  deleteCookie(c, "oauth_code_verifier");

  if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
    return c.json({ error: "Invalid state", code: "INVALID_OAUTH_STATE" }, 400);
  }

  let tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch (e) {
    if (e instanceof OAuth2RequestError) {
      return c.json({ error: e.message, code: "OAUTH_ERROR" }, 400);
    }
    if (e instanceof ArcticFetchError) {
      return c.json({ error: "OAuth provider unreachable", code: "OAUTH_FETCH_ERROR" }, 502);
    }
    throw e;
  }

  const claims = decodeIdToken(tokens.idToken()) as {
    sub: string;
    email?: string;
    name?: string;
  };
  const { sub, email = null, name = null } = claims;

  const [user] = await db
    .insert(users)
    .values({ googleSub: sub, email, name })
    .onConflictDoUpdate({ target: users.googleSub, set: { email, name } })
    .returning();

  const token = await new SignJWT({ sub: user!.id, googleSub: sub, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  setCookie(c, "session", token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });

  return c.redirect(FRONTEND_URL, 302);
});

const meRoute = createRoute({
  method: "get",
  path: "/me",
  middleware: [authMiddleware] as const,
  responses: {
    200: {
      content: { "application/json": { schema: MeResponseSchema } },
      description: "Current user",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Unauthenticated",
    },
  },
});

authRouter.openapi(meRoute, async (c) => {
  const { id } = c.get("user");
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return c.json(
    {
      id: user!.id,
      email: user!.email,
      name: user!.name,
      createdAt: user!.createdAt.toISOString(),
    },
    200
  );
});
