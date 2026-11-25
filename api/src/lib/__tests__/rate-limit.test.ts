// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  test("allows up to max per window, then refuses", () => {
    const l = createRateLimiter(2, 1000, () => 0);
    expect([l.allow("a"), l.allow("a"), l.allow("a")]).toEqual([true, true, false]);
  });

  test("keys are independent", () => {
    const l = createRateLimiter(1, 1000, () => 0);
    expect([l.allow("a"), l.allow("b"), l.allow("a")]).toEqual([true, true, false]);
  });

  test("a new window starts after windowMs", () => {
    let t = 0;
    const l = createRateLimiter(1, 1000, () => t);
    expect(l.allow("a")).toBe(true);
    expect(l.allow("a")).toBe(false);
    t = 1000;
    expect(l.allow("a")).toBe(true);
  });
});
