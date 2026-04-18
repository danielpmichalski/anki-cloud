import { SignJWT } from "jose";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { users, storageConnections } from "@anki-cloud/db/schema";
import { TEST_JWT_SECRET } from "@/setup";

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
  const db = drizzle(sqlite, { schema: { users, storageConnections } });

  const u: SeedUser = {
    id: crypto.randomUUID(),
    email: overrides.email ?? `test-${crypto.randomUUID()}@example.com`,
    name: overrides.name ?? "Test User",
    syncPasswordHash: overrides.syncPasswordHash ?? null,
    ...overrides,
  };

  await db.insert(users).values({
    id: u.id,
    googleSub: `google-sub-${u.id}`,
    email: u.email,
    name: u.name,
    syncPasswordHash: u.syncPasswordHash ?? null,
  });

  sqlite.close();
  return u;
}

export async function seedLocalStorage(dbPath: string, userId: string): Promise<void> {
  const sqlite = new Database(dbPath, { readwrite: true });
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema: { storageConnections } });

  await db.insert(storageConnections).values({
    id: crypto.randomUUID(),
    userId,
    provider: "local" as "gdrive",  // "local" accepted by Rust but not in TS schema enum
    oauthToken: "",
    oauthRefreshToken: "",
    folderPath: "/AnkiSync",
  });

  sqlite.close();
}

export async function mintSessionJwt(userId: string): Promise<string> {
  const secret = new Uint8Array(Buffer.from(TEST_JWT_SECRET, "hex"));
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}
