// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {eq} from "drizzle-orm";
import {OpenAPIHono, createRoute, z} from "@hono/zod-openapi";
import {db, userSyncConfig, userSyncState} from "@anki-cloud/db";
import {authWebMiddleware} from "@/middleware/auth";
import type {Env} from "@/types";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PASSWORD_LENGTH = 32;

function generatePassword(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
    return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]).join("");
}

const ErrorSchema = z.object({error: z.string(), code: z.string()});

const SyncCredentialsSchema = z.object({
    username: z.string().email().nullable(),
    password: z.string().nullable(),
});

const getSyncPasswordRoute = createRoute({
    method: "get",
    path: "/me/sync-password",
    middleware: [authWebMiddleware] as const,
    responses: {
        200: {
            content: {"application/json": {schema: SyncCredentialsSchema}},
            description: "Sync credentials. Password is returned once (on first call or after reset); null if already set.",
        },
        401: {
            content: {"application/json": {schema: ErrorSchema}},
            description: "Unauthenticated",
        },
    },
});

const resetSyncPasswordRoute = createRoute({
    method: "post",
    path: "/me/sync-password/reset",
    middleware: [authWebMiddleware] as const,
    responses: {
        200: {
            content: {"application/json": {schema: SyncCredentialsSchema}},
            description: "New sync credentials with plaintext password.",
        },
        401: {
            content: {"application/json": {schema: ErrorSchema}},
            description: "Unauthenticated",
        },
    },
});

export const syncCredentialsRouter = new OpenAPIHono<Env>();

syncCredentialsRouter.openapi(getSyncPasswordRoute, async (c) => {
    const {id, email} = c.get("user");

    const [config] = await db
        .select()
        .from(userSyncConfig)
        .where(eq(userSyncConfig.userId, id))
        .limit(1);

    if (config?.syncPasswordHash !== null && config?.syncPasswordHash !== undefined) {
        return c.json({username: email, password: null}, 200);
    }

    const password = generatePassword();
    const hash = await Bun.password.hash(password, {algorithm: "bcrypt", cost: 10});

    await db
        .insert(userSyncConfig)
        .values({userId: id, syncPasswordHash: hash})
        .onConflictDoUpdate({
            target: userSyncConfig.userId,
            set: {syncPasswordHash: hash},
        });

    return c.json({username: email, password}, 200);
});

syncCredentialsRouter.openapi(resetSyncPasswordRoute, async (c) => {
    const {id, email} = c.get("user");

    const password = generatePassword();
    const hash = await Bun.password.hash(password, {algorithm: "bcrypt", cost: 10});

    await db
        .insert(userSyncConfig)
        .values({userId: id, syncPasswordHash: hash})
        .onConflictDoUpdate({
            target: userSyncConfig.userId,
            set: {syncPasswordHash: hash},
        });

    // Invalidate any existing hkey so the sync server rejects the old session.
    await db.update(userSyncState).set({syncKey: null}).where(eq(userSyncState.userId, id));

    return c.json({username: email, password}, 200);
});
