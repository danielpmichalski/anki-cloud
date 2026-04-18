import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startStack, type TestStack } from "@/setup";
import { makeApiClient } from "@/helpers/api";

describe("API health", () => {
  let stack: TestStack;

  beforeAll(async () => {
    stack = await startStack();
  });

  afterAll(async () => {
    await stack.cleanup();
  });

  it("GET /health returns ok", async () => {
    const api = makeApiClient(`http://localhost:${stack.apiPort}`);
    expect(await api.health()).toBe(true);
  });
});
