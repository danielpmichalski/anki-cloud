import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import { db, users } from "@anki-cloud/db";
import { eq } from "drizzle-orm";
import type { Env } from "@/types";

const secret = new Uint8Array(Buffer.from(process.env.JWT_SECRET!, "hex"));

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
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
