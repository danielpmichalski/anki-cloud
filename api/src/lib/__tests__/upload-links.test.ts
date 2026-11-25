// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { beforeAll, describe, expect, test } from "bun:test";

// In-memory database with the real migrations applied; set before @anki-cloud/db is first imported.
process.env.DATABASE_URL = ":memory:";

let links: typeof import("@/lib/upload-links");
let dbm: typeof import("@anki-cloud/db");

beforeAll(async () => {
  dbm = await import("@anki-cloud/db");
  const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
  migrate(dbm.db, { migrationsFolder: `${import.meta.dir}/../../../../db/src/migrations` });
  const now = new Date();
  await dbm.db.insert(dbm.user).values([
    { id: "u1", name: "One", email: "one@example.com", emailVerified: true, createdAt: now, updatedAt: now },
    { id: "u2", name: "Two", email: "two@example.com", emailVerified: true, createdAt: now, updatedAt: now },
  ]);
  links = await import("@/lib/upload-links");
});

describe("upload links", () => {
  test("claim works once, then fails", async () => {
    const { token } = await links.createUploadToken("u1");
    expect(await links.isUploadTokenValid(token)).toBe(true);
    expect(await links.claimUploadToken(token)).toEqual({ userId: "u1", email: "one@example.com" });
    expect(await links.claimUploadToken(token)).toBeNull();
    expect(await links.isUploadTokenValid(token)).toBe(false);
  });

  test("the token is tied to the user that minted it", async () => {
    const { token } = await links.createUploadToken("u2");
    expect((await links.claimUploadToken(token))?.email).toBe("two@example.com");
  });

  test("stops working after 5 minutes", async () => {
    const now = new Date();
    const { token, expiresAt } = await links.createUploadToken("u1", now);
    expect(expiresAt.getTime() - now.getTime()).toBe(5 * 60 * 1000);
    const late = new Date(now.getTime() + 5 * 60 * 1000 + 1);
    expect(await links.isUploadTokenValid(token, late)).toBe(false);
    expect(await links.claimUploadToken(token, late)).toBeNull();
    // still fine just before the deadline
    expect(await links.claimUploadToken(token, new Date(now.getTime() + 5 * 60 * 1000 - 1))).not.toBeNull();
  });

  test("an unknown token is rejected", async () => {
    expect(await links.isUploadTokenValid("nope")).toBe(false);
    expect(await links.claimUploadToken("nope")).toBeNull();
  });

  test("a released token can be claimed again", async () => {
    const { token } = await links.createUploadToken("u1");
    await links.claimUploadToken(token);
    await links.releaseUploadToken(token);
    expect(await links.claimUploadToken(token)).not.toBeNull();
  });

  test("only a hash is stored", async () => {
    const { token } = await links.createUploadToken("u1");
    const rows = await dbm.db.select().from(dbm.mediaUploadToken);
    expect(rows.some((r) => r.tokenHash === token)).toBe(false);
    expect(rows.every((r) => r.tokenHash.length === 64)).toBe(true);
  });

  test("expired rows are cleaned up when a new link is minted", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { token } = await links.createUploadToken("u1", old);
    await links.createUploadToken("u1");
    expect(await links.isUploadTokenValid(token, old)).toBe(false);
  });
});
