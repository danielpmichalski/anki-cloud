// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {betterAuth} from "better-auth";
import {mcp} from "better-auth/plugins";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {db} from "@anki-cloud/db";

const trustedOrigins = process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [process.env.FRONTEND_URL ?? "http://localhost:5173"];

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

// Public URL of the remote MCP server; it is the OAuth resource that access tokens are issued for.
export const mcpPublicUrl = process.env.MCP_PUBLIC_URL ?? "http://localhost:3001";

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    basePath: "/v1/auth",
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins,
    database: drizzleAdapter(db, {
        provider: "sqlite",
    }),
    plugins: [
        // OAuth 2.1 authorization server for the Claude connectors: dynamic client registration,
        // authorization code + PKCE, refresh tokens. Users sign in through the normal web login.
        mcp({
            loginPage: frontendUrl,
            resource: `${mcpPublicUrl}/mcp`,
            oidcConfig: {
                loginPage: frontendUrl,
                requirePKCE: true,
                allowPlainCodeChallengeMethod: false,
                // Without offline_access no refresh token is issued and the connector would re-auth hourly.
                defaultScope: "openid offline_access",
                accessTokenExpiresIn: 60 * 60,
                refreshTokenExpiresIn: 60 * 60 * 24 * 30,
            },
        }),
    ],
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
    },
});
