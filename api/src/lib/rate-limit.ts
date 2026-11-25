// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.

/**
 * Fixed-window limiter, in memory (per API process). Good enough to blunt abuse of the public
 * upload endpoints; the API runs as a single instance.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    /** Count a request for `key`; false once the key is over its limit for the current window. */
    allow(key: string): boolean {
      const t = now();
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      const h = hits.get(key);
      if (!h || h.resetAt <= t) {
        hits.set(key, { count: 1, resetAt: t + windowMs });
        return true;
      }
      h.count++;
      return h.count <= max;
    },
  };
}
