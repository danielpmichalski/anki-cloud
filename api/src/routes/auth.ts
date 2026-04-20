// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {OpenAPIHono, createRoute, z} from "@hono/zod-openapi";
import {eq} from "drizzle-orm";
import {db, user} from "@anki-cloud/db";
import {authWebMiddleware} from "@/middleware/auth";
import type {Env} from "@/types";

const ErrorSchema = z.object({error: z.string(), code: z.string()});

const MeResponseSchema = z.object({
    id: z.string(),
    email: z.string().email().nullable(),
    name: z.string().nullable(),
    createdAt: z.string().datetime(),
});

export const authRouter = new OpenAPIHono<Env>();

const meRoute = createRoute({
    method: "get",
    path: "/me",
    middleware: [authWebMiddleware] as const,
    responses: {
        200: {
            content: {"application/json": {schema: MeResponseSchema}},
            description: "Current user",
        },
        401: {
            content: {"application/json": {schema: ErrorSchema}},
            description: "Unauthenticated",
        },
    },
});

authRouter.openapi(meRoute, async (c) => {
    const {id} = c.get("user");
    const [u] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return c.json(
        {
            id: u!.id,
            email: u!.email,
            name: u!.name,
            createdAt: u!.createdAt.toISOString(),
        },
        200
    );
});
