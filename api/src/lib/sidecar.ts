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

export const sidecar = {
  listDecks: (email: string) =>
    sidecarRequest<{ decks: { id: string; name: string }[] }>(
      email,
      "/internal/v1/decks"
    ),

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

  listNotes: (email: string, deckId: string) =>
    sidecarRequest<{ notes: Note[] }>(
      email,
      `/internal/v1/decks/${deckId}/notes`
    ),

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

  searchNotes: (email: string, q: string) =>
    sidecarRequest<{ notes: Note[] }>(
      email,
      `/internal/v1/notes/search?q=${encodeURIComponent(q)}`
    ),
};

export interface Note {
  id: string;
  noteTypeId: string;
  tags: string[];
  fields: Record<string, string>;
}
