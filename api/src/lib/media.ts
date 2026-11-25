// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.

/** HTML to paste into a note field for a stored media file. */
export function htmlSnippet(name: string, mimeType: string): string {
  return mimeType.startsWith("audio/") ? `[sound:${name}]` : `<img src="${name.replace(/"/g, "&quot;")}">`;
}
