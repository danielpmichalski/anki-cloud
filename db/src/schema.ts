// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {relations} from "drizzle-orm";
import {index, integer, sqliteTable, text, unique} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    googleSub: text("google_sub").notNull().unique(),
    email: text("email"),
    name: text("name"),
    createdAt: integer("created_at", {mode: "timestamp"})
        .notNull()
        .$defaultFn(() => new Date()),
    syncPasswordHash: text("sync_password_hash"),
});

export const storageConnections = sqliteTable(
    "storage_connections",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, {onDelete: "cascade"}),
        provider: text("provider", {enum: ["gdrive", "dropbox", "s3"]}).notNull(),
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

export const usersApiKeys = sqliteTable(
    "users_api_keys",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => users.id, {onDelete: "cascade"}),
        keyHash: text("key_hash").notNull(),
        label: text("label").notNull(),
        lastUsedAt: integer("last_used_at", {mode: "timestamp"}),
        createdAt: integer("created_at", {mode: "timestamp"})
            .notNull()
            .$defaultFn(() => new Date()),
        revokedAt: integer("revoked_at", {mode: "timestamp"}),
    },
    (t) => [
        index("idx_api_keys_user_id").on(t.userId),
        index("idx_api_keys_hash").on(t.keyHash),
    ]
);

export const usersSyncState = sqliteTable(
    "users_sync_state",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .unique()
            .references(() => users.id, {onDelete: "cascade"}),
        lastSyncAt: integer("last_sync_at", {mode: "timestamp"}),
        clientVersion: text("client_version"),
        syncKey: text("sync_key"),
    },
    (t) => [index("idx_sync_state_user_id").on(t.userId)]
);

export const usersRelations = relations(users, ({many, one}) => ({
    storageConnections: many(storageConnections),
    apiKeys: many(usersApiKeys),
    syncState: one(usersSyncState, {
        fields: [users.id],
        references: [usersSyncState.userId],
    }),
}));

export const storageConnectionsRelations = relations(storageConnections, ({one}) => ({
    user: one(users, {fields: [storageConnections.userId], references: [users.id]}),
}));

export const usersApiKeysRelations = relations(usersApiKeys, ({one}) => ({
    user: one(users, {fields: [usersApiKeys.userId], references: [users.id]}),
}));

export const usersSyncStateRelations = relations(usersSyncState, ({one}) => ({
    user: one(users, {fields: [usersSyncState.userId], references: [users.id]}),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type StorageConnection = typeof storageConnections.$inferSelect;
export type NewStorageConnection = typeof storageConnections.$inferInsert;
export type UsersApiKey = typeof usersApiKeys.$inferSelect;
export type NewUsersApiKey = typeof usersApiKeys.$inferInsert;
export type UsersSyncState = typeof usersSyncState.$inferSelect;
export type NewUsersSyncState = typeof usersSyncState.$inferInsert;
