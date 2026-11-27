// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { storeMedia } from "@/lib/media-store";
import { createRateLimiter } from "@/lib/rate-limit";
import { claimUploadToken, isUploadTokenValid, releaseUploadToken } from "@/lib/upload-links";
import { expiredPageHtml, UPLOAD_PAGE_HEADERS, uploadPageHtml } from "@/lib/upload-page";

// Browser-facing, unauthenticated: the single-use token in the URL is the credential (no cookies involved).
// Not part of the public OpenAPI spec.
export const uploadRouter = new Hono();

const limiter = createRateLimiter(30, 60 * 1000);

// Header carrying the client IP, set by your reverse proxy. Only trust it if the proxy overwrites it.
const CLIENT_IP_HEADER = (process.env.CLIENT_IP_HEADER || "x-forwarded-for").toLowerCase();

function clientKey(req: Request): string {
  return req.headers.get(CLIENT_IP_HEADER)?.split(",")[0]?.trim() || "unknown";
}

uploadRouter.use("/upload/*", async (c, next) => {
  if (!limiter.allow(clientKey(c.req.raw))) {
    return c.json({ error: "too many requests" }, 429, { "retry-after": "60" });
  }
  await next();
});

uploadRouter.get("/upload/:token", async (c) => {
  const valid = await isUploadTokenValid(c.req.param("token"));
  return c.body(valid ? uploadPageHtml : expiredPageHtml, valid ? 200 : 410, UPLOAD_PAGE_HEADERS);
});

// MEDIA-LIMITS: largest allowed file (10 MB audio) plus multipart overhead; the sidecar enforces the
// per-type caps (anki-cloud-sync/sync-storage-server/src/media.rs). Raise this with MAX_AUDIO_BYTES.
uploadRouter.post(
  "/upload/:token",
  bodyLimit({ maxSize: 11 * 1024 * 1024, onError: (c) => c.json({ error: "file too large (limits: images 5 MB, audio 10 MB, SVG 200 KB)" }, 413) }),
  async (c) => {
    // A browser always sends Origin on cross-site POSTs; refuse any that is not this host.
    const origin = c.req.header("origin");
    if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: "forbidden" }, 403);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return c.json({ error: "missing file" }, 400);
    if (!file.name) return c.json({ error: "missing file name" }, 400);

    const token = c.req.param("token");
    const claim = await claimUploadToken(token);
    if (!claim) return c.json({ error: "link expired or already used" }, 410);
    if (!claim.email) {
      await releaseUploadToken(token);
      return c.json({ error: "no email on account" }, 401);
    }

    const res = await storeMedia(c, claim.email, file.name, new Uint8Array(await file.arrayBuffer()));
    // Rejected files (wrong type, too big, ...) do not use up the link; the user can pick another file.
    if (res.status >= 400) await releaseUploadToken(token);
    res.headers.set("cache-control", "no-store");
    return res;
  }
);
