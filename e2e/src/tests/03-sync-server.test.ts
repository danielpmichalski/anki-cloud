/**
 * Tests for the Rust sync server: authentication (hostKey), health check,
 * and basic sync flow using the Anki sync protocol v11.
 *
 * Requires the sync server binary at anki-sync-server/target/debug/anki-sync-server.
 * Build with: cd anki-sync-server && cargo build --bin anki-sync-server
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { compress } from "@mongodb-js/zstd";
import { startStack, type TestStack } from "@/setup";
import { seedUser, seedLocalStorage, mintSessionJwt } from "@/helpers/auth";
import { makeApiClient } from "@/helpers/api";
import { makeSyncClient } from "@/helpers/sync";

describe("Sync server — authentication", () => {
  let stack: TestStack;
  let email: string;

  beforeAll(async () => {
    stack = await startStack();
    email = `sync-user-${crypto.randomUUID()}@example.com`;

    // Create user via API (generates sync password, returns it once)
    const user = await seedUser(stack.dbPath, { email });
    await seedLocalStorage(stack.dbPath, user.id);
    const jwt = await mintSessionJwt(user.id);
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.getSyncPassword(jwt);
    // Store for tests
    (stack as TestStack & { syncPassword: string }).syncPassword = creds.password as string;
  });

  afterAll(async () => {
    await stack.cleanup();
  });

  it("Sync server health check passes", async () => {
    const sync = makeSyncClient(`http://localhost:${stack.syncPort}`);
    expect(await sync.healthCheck()).toBe(true);
  });

  it("hostKey — valid credentials return hkey", async () => {
    const sync = makeSyncClient(`http://localhost:${stack.syncPort}`);
    const { syncPassword } = stack as TestStack & { syncPassword: string };
    const hkey = await sync.hostKey(email, syncPassword);

    expect(typeof hkey).toBe("string");
    expect(hkey.length).toBeGreaterThan(0);
  });

  it("hostKey — wrong password returns 403", async () => {
    const res = await fetch(`http://localhost:${stack.syncPort}/sync/hostKey`, {
      method: "POST",
      headers: {
        "anki-sync": JSON.stringify({ v: 11, k: "", c: "test", s: "" }),
        "content-type": "application/octet-stream",
      },
      body: await compress(Buffer.from(JSON.stringify({ u: email, p: "wrong-password" }))) as unknown as BodyInit,
    });
    expect(res.status).toBe(403);
  });

  it("hostKey — unknown user returns 403", async () => {
    const res = await fetch(`http://localhost:${stack.syncPort}/sync/hostKey`, {
      method: "POST",
      headers: {
        "anki-sync": JSON.stringify({ v: 11, k: "", c: "test", s: "" }),
        "content-type": "application/octet-stream",
      },
      body: await compress(Buffer.from(JSON.stringify({ u: "nobody@example.com", p: "any" }))) as unknown as BodyInit,
    });
    expect(res.status).toBe(403);
  });
});

describe("Sync server — stateless re-hydration", () => {
  let stack: TestStack;
  let email: string;
  let hkey: string;

  beforeAll(async () => {
    stack = await startStack();
    email = `rehydrate-${crypto.randomUUID()}@example.com`;

    const user = await seedUser(stack.dbPath, { email });
    await seedLocalStorage(stack.dbPath, user.id);
    const jwt = await mintSessionJwt(user.id);
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    const creds = await api.getSyncPassword(jwt);

    const sync = makeSyncClient(`http://localhost:${stack.syncPort}`);
    hkey = await sync.hostKey(email, creds.password as string);
  });

  afterAll(async () => {
    await stack.cleanup();
  });

  it("hkey obtained on one call is usable on a second call (in-memory session)", async () => {
    // The sync server should find hkey in the in-memory map
    const sync = makeSyncClient(`http://localhost:${stack.syncPort}`);
    // meta requires opening the collection, which triggers storage lookup
    // For "local" provider this is a no-op fetch, so it should succeed
    const skey = crypto.randomUUID().replace(/-/g, "");
    const result = await sync.meta(hkey, skey);
    expect(result).toBeDefined();
  });
});
