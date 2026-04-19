// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
/**
 * Tests that resetting a sync password invalidates the old hkey.
 * Old Anki clients must re-authenticate to get a new hkey.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { compress } from "@mongodb-js/zstd";
import { startStack, type TestStack } from "@/setup";
import { seedUser, seedLocalStorage, mintSessionJwt } from "@/helpers/auth";
import { makeApiClient } from "@/helpers/api";
import { makeSyncClient } from "@/helpers/sync";

describe("Sync password rotation", () => {
  let stack: TestStack;
  let email: string;
  let oldPassword: string;

  beforeAll(async () => {
    stack = await startStack();
    email = `rotation-${crypto.randomUUID()}@example.com`;

    const user = await seedUser(stack.dbPath, { email });
    await seedLocalStorage(stack.dbPath, user.id);
    const jwt = await mintSessionJwt(user.id);
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.getSyncPassword(jwt);
    oldPassword = creds.password as string;
  });

  afterAll(async () => {
    await stack.cleanup();
  });

  it("Old password authenticates before reset", async () => {
    const sync = makeSyncClient(`http://localhost:${stack.syncPort}`);
    const hkey = await sync.hostKey(email, oldPassword);
    expect(hkey.length).toBeGreaterThan(0);
  });

  it("After reset, old password is rejected", async () => {
    const { dbPath, apiPort, syncPort } = stack;

    // Look up the existing user's JWT from their seeded record
    // (This test creates a fresh user for the rotation check)
    const freshEmail = `rotate-fresh-${crypto.randomUUID()}@example.com`;
    const freshUser = await seedUser(dbPath, { email: freshEmail });
    await seedLocalStorage(dbPath, freshUser.id);
    const freshJwt = await mintSessionJwt(freshUser.id);
    const freshApi = makeApiClient(`http://localhost:${apiPort}`);

    const initialCreds = await freshApi.getSyncPassword(freshJwt);
    const initialPassword = initialCreds.password as string;

    // Verify initial password works
    const sync = makeSyncClient(`http://localhost:${syncPort}`);
    const hkeyBefore = await sync.hostKey(freshEmail, initialPassword);
    expect(hkeyBefore.length).toBeGreaterThan(0);

    // Reset
    const newCreds = await freshApi.resetSyncPassword(freshJwt);
    const newPassword = newCreds.password as string;
    expect(newPassword).not.toBe(initialPassword);

    // Old password now rejected
    const oldPasswordRes = await fetch(`http://localhost:${syncPort}/sync/hostKey`, {
      method: "POST",
      headers: {
        "anki-sync": JSON.stringify({ v: 11, k: "", c: "test", s: "" }),
        "content-type": "application/octet-stream",
      },
      body: await compress(Buffer.from(JSON.stringify({ u: freshEmail, p: initialPassword }))) as unknown as BodyInit,
    });
    expect(oldPasswordRes.status).toBe(403);

    // New password works
    const hkeyAfter = await sync.hostKey(freshEmail, newPassword);
    expect(hkeyAfter.length).toBeGreaterThan(0);
  });
});
