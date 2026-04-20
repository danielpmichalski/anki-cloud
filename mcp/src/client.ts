// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.

const API_URL = process.env["API_URL"] ?? "http://localhost:3000";
const API_KEY = process.env["API_KEY"] ?? "";

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...((options?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "api error" }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
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
