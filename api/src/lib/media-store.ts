// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import type { Context } from "hono";
import { htmlSnippet } from "@/lib/media";
import { sidecar } from "@/lib/sidecar";

/** Map a failed sidecar response to our error shape; null when it was ok. */
export async function sidecarFailure(c: Context, res: Response): Promise<Response | null> {
  if (res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const status = [400, 404, 413, 415].includes(res.status) ? res.status : 502;
  return c.json({ error: body.error ?? FALLBACK_ERRORS[status] ?? "storage error" }, status as never);
}

/**
 * MEDIA-LIMITS: the text below repeats the type allowlist and size caps defined in
 * anki-cloud-sync/sync-storage-server/src/media.rs (see the list there). Update it with them.
 * Used when the sidecar answers without a JSON error body (e.g. the HTTP layer rejects an oversized body).
 */
const FALLBACK_ERRORS: Record<number, string> = {
  400: "invalid media request",
  404: "media file not found",
  413: "file too large (limits: images 5 MB, audio 10 MB, SVG 200 KB)",
  415: "unsupported file type (png, jpg, gif, webp, svg, mp3, ogg, wav, m4a, 3gp and amr are accepted)",
};

/** Store a file through the sidecar. Shared by POST /v1/media and the upload page receiver. */
export async function storeMedia(c: Context, email: string, name: string, data: Uint8Array): Promise<Response> {
  const res = await sidecar.addMedia(email, name, data);
  const failure = await sidecarFailure(c, res);
  if (failure) return failure;
  const r = (await res.json()) as { name: string; added: boolean; mimeType: string; size: number };
  return c.json({ ...r, html: htmlSnippet(r.name, r.mimeType) }, res.status === 201 ? 201 : 200);
}
