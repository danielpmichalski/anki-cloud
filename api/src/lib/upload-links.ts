// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db, mediaUploadToken, user } from "@anki-cloud/db";

export const UPLOAD_LINK_TTL_MS = 5 * 60 * 1000;

async function sha256Hex(s: string): Promise<string> {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).toString("hex");
}

/** Mint a single-use token tied to `userId`. The raw token is returned once and never stored. */
export async function createUploadToken(userId: string, now = new Date()) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const expiresAt = new Date(now.getTime() + UPLOAD_LINK_TTL_MS);
  await db.insert(mediaUploadToken).values({ userId, tokenHash: await sha256Hex(token), expiresAt, createdAt: now });
  // Housekeeping: drop rows that expired more than an hour ago.
  await db.delete(mediaUploadToken).where(lt(mediaUploadToken.expiresAt, new Date(now.getTime() - 60 * 60 * 1000)));
  return { token, expiresAt };
}

/** True while the token exists, is unused and unexpired. Does not consume it (used to render the page). */
export async function isUploadTokenValid(token: string, now = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ id: mediaUploadToken.id })
    .from(mediaUploadToken)
    .where(and(eq(mediaUploadToken.tokenHash, await sha256Hex(token)), isNull(mediaUploadToken.usedAt), gt(mediaUploadToken.expiresAt, now)))
    .limit(1);
  return !!row;
}

/** Atomically consume the token. Returns the user's id and email, or null if it is unknown, used or expired. */
export async function claimUploadToken(token: string, now = new Date()): Promise<{ userId: string; email: string | null } | null> {
  const hash = await sha256Hex(token);
  const [row] = await db
    .update(mediaUploadToken)
    .set({ usedAt: now })
    .where(and(eq(mediaUploadToken.tokenHash, hash), isNull(mediaUploadToken.usedAt), gt(mediaUploadToken.expiresAt, now)))
    .returning({ userId: mediaUploadToken.userId });
  if (!row) return null;
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, row.userId)).limit(1);
  return { userId: row.userId, email: u?.email ?? null };
}

/** Give a claimed token back (the upload was rejected), so the user can retry until it expires. */
export async function releaseUploadToken(token: string): Promise<void> {
  await db.update(mediaUploadToken).set({ usedAt: null }).where(eq(mediaUploadToken.tokenHash, await sha256Hex(token)));
}
