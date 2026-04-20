// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { user, session, userSyncConfig, userStorageConnection } from "@anki-cloud/db/schema";

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  syncPasswordHash?: string | null;
}

export async function seedUser(
  dbPath: string,
  overrides: Partial<SeedUser> = {}
): Promise<SeedUser> {
  const sqlite = new Database(dbPath, { readwrite: true });
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema: { user, userSyncConfig } });

  const u: SeedUser = {
    id: crypto.randomUUID(),
    email: overrides.email ?? `test-${crypto.randomUUID()}@example.com`,
    name: overrides.name ?? "Test User",
    syncPasswordHash: overrides.syncPasswordHash ?? null,
    ...overrides,
  };

  const now = new Date();
  await db.insert(user).values({
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  if (u.syncPasswordHash) {
    await db.insert(userSyncConfig).values({
      userId: u.id,
      syncPasswordHash: u.syncPasswordHash,
    });
  }

  sqlite.close();
  return u;
}

export async function seedLocalStorage(dbPath: string, userId: string): Promise<void> {
  const sqlite = new Database(dbPath, { readwrite: true });
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema: { userStorageConnection } });

  await db.insert(userStorageConnection).values({
    id: crypto.randomUUID(),
    userId,
    provider: "local" as "google",  // "local" accepted by Rust but not in TS schema enum
    oauthToken: "",
    oauthRefreshToken: "",
    folderPath: "/AnkiSync",
  });

  sqlite.close();
}

/** Insert a Better Auth session row and return the token (used as the session cookie value). */
export async function createTestSession(dbPath: string, userId: string): Promise<string> {
  const sqlite = new Database(dbPath, { readwrite: true });
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema: { session } });

  const token = crypto.randomUUID();
  const now = new Date();
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    createdAt: now,
    updatedAt: now,
  });

  sqlite.close();
  return token;
}
