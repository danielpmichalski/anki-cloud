// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {relations} from "drizzle-orm";
import {index, integer, sqliteTable, text, unique} from "drizzle-orm/sqlite-core";

// ── Better Auth tables (owned by Better Auth, do not add app columns here) ────

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", {mode: "boolean"}).notNull(),
    image: text("image"),
    createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
    updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
});

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, {onDelete: "cascade"}),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", {mode: "timestamp"}).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
    updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
});

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    userId: text("user_id")
        .notNull()
        .references(() => user.id, {onDelete: "cascade"}),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {mode: "timestamp"}),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {mode: "timestamp"}),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
    updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
});

export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", {mode: "timestamp"}).notNull(),
    createdAt: integer("created_at", {mode: "timestamp"}),
    updatedAt: integer("updated_at", {mode: "timestamp"}),
});

// OAuth 2.1 provider tables for the remote MCP server (Better Auth `mcp` plugin).
export const oauthApplication = sqliteTable("oauth_application", {
    id: text("id").primaryKey(),
    name: text("name"),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls").notNull(),
    type: text("type").notNull(),
    disabled: integer("disabled", {mode: "boolean"}).default(false),
    userId: text("user_id").references(() => user.id, {onDelete: "cascade"}),
    createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
    updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
}, (t) => [index("oauth_application_user_idx").on(t.userId)]);

export const oauthAccessToken = sqliteTable("oauth_access_token", {
    id: text("id").primaryKey(),
    accessToken: text("access_token").notNull().unique(),
    refreshToken: text("refresh_token").notNull().unique(),
    accessTokenExpiresAt: integer("access_token_expires_at", {mode: "timestamp"}).notNull(),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {mode: "timestamp"}).notNull(),
    clientId: text("client_id").notNull().references(() => oauthApplication.clientId, {onDelete: "cascade"}),
    userId: text("user_id").references(() => user.id, {onDelete: "cascade"}),
    scopes: text("scopes").notNull(),
    createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
    updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
}, (t) => [index("oauth_access_token_client_idx").on(t.clientId), index("oauth_access_token_user_idx").on(t.userId)]);

export const oauthConsent = sqliteTable("oauth_consent", {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().references(() => oauthApplication.clientId, {onDelete: "cascade"}),
    userId: text("user_id").notNull().references(() => user.id, {onDelete: "cascade"}),
    scopes: text("scopes").notNull(),
    consentGiven: integer("consent_given", {mode: "boolean"}).notNull(),
    createdAt: integer("created_at", {mode: "timestamp"}).notNull(),
    updatedAt: integer("updated_at", {mode: "timestamp"}).notNull(),
}, (t) => [index("oauth_consent_client_idx").on(t.clientId), index("oauth_consent_user_idx").on(t.userId)]);

// ── App tables ────────────────────────────────────────────────────────────────

export const userSyncConfig = sqliteTable("user_sync_config", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .unique()
        .references(() => user.id, {onDelete: "cascade"}),
    syncPasswordHash: text("sync_password_hash"),
});

export const userStorageConnection = sqliteTable(
    "user_storage_connection",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, {onDelete: "cascade"}),
        provider: text("provider", {enum: ["google", "dropbox", "s3"]}).notNull(),
        oauthToken: text("oauth_token").notNull(),
        oauthRefreshToken: text("oauth_refresh_token").notNull(),
        folderPath: text("folder_path").notNull().default("/AnkiCloudSync"),
        connectedAt: integer("connected_at", {mode: "timestamp"})
            .notNull()
            .$defaultFn(() => new Date()),
    },
    (t) => [
        unique("uq_storage_user_provider").on(t.userId, t.provider),
        index("idx_storage_user_id").on(t.userId),
    ]
);

export const userApiKey = sqliteTable(
    "user_api_key",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, {onDelete: "cascade"}),
        keyHash: text("key_hash").notNull(),
        label: text("label").notNull(),
        lastUsedAt: integer("last_used_at", {mode: "timestamp"}),
        createdAt: integer("created_at", {mode: "timestamp"})
            .notNull()
            .$defaultFn(() => new Date()),
        revokedAt: integer("revoked_at", {mode: "timestamp"}),
    },
    (t) => [
        index("idx_api_key_user_id").on(t.userId),
        index("idx_api_key_hash").on(t.keyHash),
    ]
);

export const userSyncState = sqliteTable(
    "user_sync_state",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .unique()
            .references(() => user.id, {onDelete: "cascade"}),
        lastSyncAt: integer("last_sync_at", {mode: "timestamp"}),
        clientVersion: text("client_version"),
        syncKey: text("sync_key"),
    },
    (t) => [index("idx_sync_state_user_id").on(t.userId)]
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({many, one}) => ({
    sessions: many(session),
    accounts: many(account),
    syncConfig: one(userSyncConfig, {
        fields: [user.id],
        references: [userSyncConfig.userId],
    }),
    storageConnections: many(userStorageConnection),
    apiKeys: many(userApiKey),
    syncState: one(userSyncState, {
        fields: [user.id],
        references: [userSyncState.userId],
    }),
}));

export const sessionRelations = relations(session, ({one}) => ({
    user: one(user, {fields: [session.userId], references: [user.id]}),
}));

export const accountRelations = relations(account, ({one}) => ({
    user: one(user, {fields: [account.userId], references: [user.id]}),
}));

export const userSyncConfigRelations = relations(userSyncConfig, ({one}) => ({
    user: one(user, {fields: [userSyncConfig.userId], references: [user.id]}),
}));

export const userStorageConnectionRelations = relations(userStorageConnection, ({one}) => ({
    user: one(user, {fields: [userStorageConnection.userId], references: [user.id]}),
}));

export const userApiKeyRelations = relations(userApiKey, ({one}) => ({
    user: one(user, {fields: [userApiKey.userId], references: [user.id]}),
}));

export const userSyncStateRelations = relations(userSyncState, ({one}) => ({
    user: one(user, {fields: [userSyncState.userId], references: [user.id]}),
}));

// ── Types ─────────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type UserSyncConfig = typeof userSyncConfig.$inferSelect;
export type NewUserSyncConfig = typeof userSyncConfig.$inferInsert;
export type UserStorageConnection = typeof userStorageConnection.$inferSelect;
export type NewUserStorageConnection = typeof userStorageConnection.$inferInsert;
export type UserApiKey = typeof userApiKey.$inferSelect;
export type NewUserApiKey = typeof userApiKey.$inferInsert;
export type UserSyncState = typeof userSyncState.$inferSelect;
export type NewUserSyncState = typeof userSyncState.$inferInsert;
