// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {createMiddleware} from "hono/factory";
import {and, eq, isNull} from "drizzle-orm";
import {db, user, userApiKey} from "@anki-cloud/db";
import {auth} from "@/auth";
import type {Env} from "@/types";

export const authWebMiddleware = createMiddleware<Env>(async (c, next) => {
    const session = await auth.api.getSession({headers: c.req.raw.headers});
    if (!session) {
        return c.json({error: "Unauthenticated", code: "MISSING_SESSION"}, 401);
    }
    c.set("user", {id: session.user.id, email: session.user.email, name: session.user.name});
    await next();
});

export const authApiMiddleware = createMiddleware<Env>(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return c.json({error: "Missing API key", code: "MISSING_API_KEY"}, 401);
    }
    const rawKey = authHeader.slice(7);
    if (!rawKey.startsWith("ak_")) {
        return c.json({error: "Invalid API key", code: "INVALID_API_KEY"}, 401);
    }

    const keyHash = Buffer.from(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey))
    ).toString("hex");

    const [row] = await db
        .select({
            keyId: userApiKey.id,
            userId: userApiKey.userId,
            userEmail: user.email,
            userName: user.name,
        })
        .from(userApiKey)
        .innerJoin(user, eq(userApiKey.userId, user.id))
        .where(and(eq(userApiKey.keyHash, keyHash), isNull(userApiKey.revokedAt)))
        .limit(1);

    if (!row) {
        return c.json({error: "Invalid or revoked API key", code: "INVALID_API_KEY"}, 401);
    }

    db.update(userApiKey)
        .set({lastUsedAt: new Date()})
        .where(eq(userApiKey.id, row.keyId))
        .execute()
        .catch(() => {});

    c.set("user", {id: row.userId, email: row.userEmail, name: row.userName});
    await next();
});
