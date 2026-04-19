// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { and, eq, isNull } from "drizzle-orm";
import { db, users, usersApiKeys } from "@anki-cloud/db";
import type { Env } from "@/types";

const secret = new Uint8Array(Buffer.from(process.env.JWT_SECRET!, "hex"));

export const authWebMiddleware = createMiddleware<Env>(async (c, next) => {
  const token = getCookie(c, "session");
  if (!token) {
    return c.json({ error: "Unauthenticated", code: "MISSING_SESSION" }, 401);
  }

  let sub: string;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") throw new Error("missing sub");
    sub = payload.sub;
  } catch {
    return c.json({ error: "Invalid or expired session", code: "INVALID_SESSION" }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, sub)).limit(1);
  if (!user) {
    return c.json({ error: "User not found", code: "USER_NOT_FOUND" }, 401);
  }

  c.set("user", { id: user.id, googleSub: user.googleSub, email: user.email, name: user.name });
  await next();
});

export const authApiMiddleware = createMiddleware<Env>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing API key", code: "MISSING_API_KEY" }, 401);
  }
  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("ak_")) {
    return c.json({ error: "Invalid API key", code: "INVALID_API_KEY" }, 401);
  }

  const keyHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey))
  ).toString("hex");

  const [row] = await db
    .select({
      keyId: usersApiKeys.id,
      userId: usersApiKeys.userId,
      userEmail: users.email,
      userName: users.name,
      userGoogleSub: users.googleSub,
    })
    .from(usersApiKeys)
    .innerJoin(users, eq(usersApiKeys.userId, users.id))
    .where(and(eq(usersApiKeys.keyHash, keyHash), isNull(usersApiKeys.revokedAt)))
    .limit(1);

  if (!row) {
    return c.json({ error: "Invalid or revoked API key", code: "INVALID_API_KEY" }, 401);
  }

  db.update(usersApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(usersApiKeys.id, row.keyId))
    .execute()
    .catch(() => {});

  c.set("user", {
    id: row.userId,
    googleSub: row.userGoogleSub,
    email: row.userEmail,
    name: row.userName,
  });
  await next();
});
