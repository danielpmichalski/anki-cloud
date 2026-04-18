import {eq} from "drizzle-orm";
import {OpenAPIHono, createRoute, z} from "@hono/zod-openapi";
import {db, users, usersSyncState} from "@anki-cloud/db";
import {authMiddleware} from "@/middleware/auth";
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
    middleware: [authMiddleware] as const,
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
    middleware: [authMiddleware] as const,
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
    const {id} = c.get("user");
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return c.json({error: "User not found", code: "USER_NOT_FOUND"}, 401);

    if (user.syncPasswordHash !== null) {
        return c.json({username: user.email, password: null}, 200);
    }

    const password = generatePassword();
    const hash = await Bun.password.hash(password, {algorithm: "bcrypt", cost: 10});
    await db.update(users).set({syncPasswordHash: hash}).where(eq(users.id, id));

    return c.json({username: user.email, password}, 200);
});

syncCredentialsRouter.openapi(resetSyncPasswordRoute, async (c) => {
    const {id} = c.get("user");
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return c.json({error: "User not found", code: "USER_NOT_FOUND"}, 401);

    const password = generatePassword();
    const hash = await Bun.password.hash(password, {algorithm: "bcrypt", cost: 10});
    await db.update(users).set({syncPasswordHash: hash}).where(eq(users.id, id));
    // Invalidate any existing hkey so the sync server rejects the old session.
    await db.update(usersSyncState).set({syncKey: null}).where(eq(usersSyncState.userId, id));

    return c.json({username: user.email, password}, 200);
});
