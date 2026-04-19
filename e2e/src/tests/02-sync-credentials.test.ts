// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
/**
 * Tests for sync password generation/reset via REST API.
 * Users authenticate via JWT session cookie (minted directly, skipping Google OAuth).
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startStack, type TestStack } from "@/setup";
import { seedUser, mintSessionJwt } from "@/helpers/auth";
import { makeApiClient } from "@/helpers/api";

describe("Sync credentials", () => {
  let stack: TestStack;
  let userId: string;
  let sessionJwt: string;

  beforeAll(async () => {
    stack = await startStack();
    const user = await seedUser(stack.dbPath, { email: "sync-test@example.com" });
    userId = user.id;
    sessionJwt = await mintSessionJwt(userId);
  });

  afterAll(async () => {
    await stack.cleanup();
  });

  it("GET /v1/me/sync-password — first call generates and returns password", async () => {
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.getSyncPassword(sessionJwt);

    expect(creds.username).toBe("sync-test@example.com");
    expect(typeof creds.password).toBe("string");
    expect((creds.password as string).length).toBe(32);
  });

  it("GET /v1/me/sync-password — second call returns null password (already set)", async () => {
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.getSyncPassword(sessionJwt);

    expect(creds.username).toBe("sync-test@example.com");
    expect(creds.password).toBeNull();
  });

  it("POST /v1/me/sync-password/reset — returns new plaintext password", async () => {
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.resetSyncPassword(sessionJwt);

    expect(creds.username).toBe("sync-test@example.com");
    expect(typeof creds.password).toBe("string");
    expect((creds.password as string).length).toBe(32);
  });

  it("GET /v1/me/sync-password — after reset, still returns null (hash is set)", async () => {
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.getSyncPassword(sessionJwt);
    expect(creds.password).toBeNull();
  });

  it("Returns 401 without session cookie", async () => {
    const res = await fetch(
      `http://localhost:${stack.apiPort}/v1/me/sync-password`
    );
    expect(res.status).toBe(401);
  });
});
