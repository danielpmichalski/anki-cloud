// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.

import { AsyncLocalStorage } from "node:async_hooks";

const API_URL = process.env["API_URL"] ?? "http://localhost:3000";
const ENV_API_KEY = process.env["API_KEY"] ?? "";

// HTTP mode: the caller's bearer key, scoped to the current request.
// Stdio mode: unset, so the process-wide API_KEY env var is used.
const requestApiKey = new AsyncLocalStorage<string>();

export function withApiKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return requestApiKey.run(key, fn);
}

async function rawRequest(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requestApiKey.getStore() ?? ENV_API_KEY}`,
      ...((options?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "api error" }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return (await rawRequest(path, options)).json() as Promise<T>;
}

export interface Deck {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  noteTypeId: string;
  tags: string[];
  fields: Record<string, string>;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

type Pagination = { limit?: number; cursor?: string };

function buildQs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const listDecks = (opts?: Pagination) =>
  apiRequest<{ decks: Deck[]; nextCursor: string | null }>(
    `/v1/decks${buildQs({ limit: opts?.limit, cursor: opts?.cursor })}`
  );

export const getDeck = (id: string) => apiRequest<Deck>(`/v1/decks/${id}`);

export const createDeck = (name: string) =>
  apiRequest<Deck>("/v1/decks", { method: "POST", body: JSON.stringify({ name }) });

export const listNotes = (deckId: string, opts?: Pagination) =>
  apiRequest<{ notes: Note[]; nextCursor: string | null }>(
    `/v1/decks/${deckId}/notes${buildQs({ limit: opts?.limit, cursor: opts?.cursor })}`
  );

export const createNote = (
  deckId: string,
  body: { fields: Record<string, string>; tags?: string[]; noteTypeId?: string }
) =>
  apiRequest<{ id: string }>(`/v1/decks/${deckId}/notes`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createNotesBulk = (
  deckId: string,
  notes: { fields: Record<string, string>; tags?: string[]; noteTypeId?: string }[]
) =>
  apiRequest<{ ids: string[] }>("/v1/cards/bulk", {
    method: "POST",
    body: JSON.stringify({ deckId, notes }),
  });

export const searchNotes = (q: string, opts?: Pagination) =>
  apiRequest<{ notes: Note[]; nextCursor: string | null }>(
    `/v1/notes/search${buildQs({ q, limit: opts?.limit, cursor: opts?.cursor })}`
  );

export const updateNote = (
  id: string,
  body: { fields: Record<string, string>; tags?: string[] }
) =>
  apiRequest<{ ok: boolean }>(`/v1/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const deleteNote = (id: string) =>
  apiRequest<{ ok: boolean }>(`/v1/notes/${id}`, { method: "DELETE" });

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewCounts {
  new: number;
  learning: number;
  review: number;
}

export interface ReviewCard {
  cardId: string;
  noteId: string;
  deck: string;
  state: "new" | "learning" | "review";
  tags: string[];
  question: string;
  answer: string;
  nextIntervals: { again: string | null; hard: string | null; good: string | null; easy: string | null };
}

export const getDueCards = (deckId: string, limit?: number) =>
  apiRequest<{ cards: ReviewCard[]; counts: ReviewCounts }>(
    `/v1/review/next${buildQs({ deckId, limit })}`
  );

export const getReviewCounts = (deckId: string) =>
  apiRequest<ReviewCounts>(`/v1/review/counts${buildQs({ deckId })}`);

export const answerCard = (body: {
  cardId: string;
  rating: ReviewRating;
  millisecondsTaken?: number;
}) =>
  apiRequest<{ ok: boolean; next: string | null }>("/v1/review/answer", {
    method: "POST",
    body: JSON.stringify(body),
  });

export interface StoredMedia {
  name: string;
  added: boolean;
  mimeType: string;
  size: number;
  html: string;
}

export interface MediaMetadata {
  name: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
}

const mediaPath = (name: string) => `/v1/media/${encodeURIComponent(name)}`;

export const createMediaUploadLink = () =>
  apiRequest<{ url: string; expiresAt: string }>("/v1/media/upload-links", { method: "POST" });

export const addSvgMedia = (name: string, content: string) =>
  apiRequest<StoredMedia>("/v1/media/svg", { method: "POST", body: JSON.stringify({ name, content }) });

export const listMedia = (opts?: Pagination) =>
  apiRequest<{ files: { name: string; size: number }[]; nextCursor: string | null }>(
    `/v1/media${buildQs({ limit: opts?.limit, cursor: opts?.cursor })}`
  );

export const getMediaMetadata = (name: string) => apiRequest<MediaMetadata>(`${mediaPath(name)}/metadata`);

export async function getMediaBytes(name: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await rawRequest(mediaPath(name));
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    mimeType: (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim(),
  };
}

export async function deleteMedia(name: string): Promise<void> {
  await rawRequest(mediaPath(name), { method: "DELETE" });
}

/** True when the REST API accepts the credential (ak_ key or OAuth access token). */
export async function isCredentialValid(credential: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/v1/whoami`, { headers: { Authorization: `Bearer ${credential}` } });
    return res.ok;
  } catch {
    return false;
  }
}
