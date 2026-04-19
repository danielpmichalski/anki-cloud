// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
const SIDECAR_URL = process.env.SIDECAR_URL ?? "http://localhost:8081";
const SIDECAR_TOKEN = process.env.SIDECAR_TOKEN ?? "";

async function sidecarRequest<T>(
  email: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${SIDECAR_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": SIDECAR_TOKEN,
      "X-User-Email": email,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "sidecar error" }));
    const err = Object.assign(
      new Error((body as { error?: string }).error ?? "sidecar error"),
      { status: res.status }
    );
    throw err;
  }
  return res.json() as Promise<T>;
}

function paginationQs(p?: { limit?: number | undefined; cursor?: string | undefined }): string {
  if (!p) return "";
  const params = new URLSearchParams();
  if (p.limit !== undefined) params.set("limit", p.limit.toString());
  if (p.cursor !== undefined) params.set("cursor", p.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const sidecar = {
  listDecks: (email: string, pagination?: { limit?: number | undefined; cursor?: string | undefined }) =>
    sidecarRequest<{ decks: { id: string; name: string }[]; nextCursor: string | null }>(
      email,
      `/internal/v1/decks${paginationQs(pagination)}`
    ).then((d) => ({ ...d, nextCursor: d.nextCursor ?? null })),

  createDeck: (email: string, name: string) =>
    sidecarRequest<{ id: string; name: string }>(email, "/internal/v1/decks", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getDeck: (email: string, id: string) =>
    sidecarRequest<{ id: string; name: string }>(
      email,
      `/internal/v1/decks/${id}`
    ),

  deleteDeck: (email: string, id: string) =>
    sidecarRequest<{ ok: boolean }>(email, `/internal/v1/decks/${id}`, {
      method: "DELETE",
    }),

  listNotes: (email: string, deckId: string, pagination?: { limit?: number | undefined; cursor?: string | undefined }) =>
    sidecarRequest<{ notes: Note[]; nextCursor: string | null }>(
      email,
      `/internal/v1/decks/${deckId}/notes${paginationQs(pagination)}`
    ).then((d) => ({ ...d, nextCursor: d.nextCursor ?? null })),

  createNote: (
    email: string,
    deckId: string,
    body: { fields: Record<string, string>; tags?: string[] | undefined; noteTypeId?: string | undefined }
  ) =>
    sidecarRequest<{ id: string }>(
      email,
      `/internal/v1/decks/${deckId}/notes`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  createNotesBulk: (
    email: string,
    deckId: string,
    notes: { fields: Record<string, string>; tags?: string[] | undefined; noteTypeId?: string | undefined }[]
  ) =>
    sidecarRequest<{ ids: string[] }>(
      email,
      `/internal/v1/decks/${deckId}/notes/bulk`,
      { method: "POST", body: JSON.stringify({ notes }) }
    ),

  getNote: (email: string, id: string) =>
    sidecarRequest<Note>(email, `/internal/v1/notes/${id}`),

  updateNote: (
    email: string,
    id: string,
    body: { fields: Record<string, string>; tags?: string[] | undefined }
  ) =>
    sidecarRequest<{ ok: boolean }>(email, `/internal/v1/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteNote: (email: string, id: string) =>
    sidecarRequest<{ ok: boolean }>(email, `/internal/v1/notes/${id}`, {
      method: "DELETE",
    }),

  searchNotes: async (email: string, q: string, pagination?: { limit?: number | undefined; cursor?: string | undefined }) => {
    const params = new URLSearchParams({ q });
    if (pagination?.limit !== undefined) params.set("limit", pagination.limit.toString());
    if (pagination?.cursor !== undefined) params.set("cursor", pagination.cursor);
    return sidecarRequest<{ notes: Note[]; nextCursor: string | null }>(
      email,
      `/internal/v1/notes/search?${params}`
    ).then((d) => ({ ...d, nextCursor: d.nextCursor ?? null }));
  },
};

export interface Note {
  id: string;
  noteTypeId: string;
  tags: string[];
  fields: Record<string, string>;
}
