// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
/** Typed REST API client for e2e tests. */

export interface ApiClient {
  getSyncPassword(sessionCookie: string): Promise<SyncCredentials>;
  resetSyncPassword(sessionCookie: string): Promise<SyncCredentials>;
  getMe(sessionCookie: string): Promise<MeResponse>;
  health(): Promise<boolean>;
}

export interface SyncCredentials {
  username: string | null;
  password: string | null;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
}

export function makeApiClient(baseUrl: string): ApiClient {
  async function get<T>(path: string, cookie: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: `session=${cookie}` },
    });
    if (!res.ok) throw new Error(`GET ${path} failed ${res.status}`);
    return res.json() as Promise<T>;
  }

  async function post<T>(path: string, cookie: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        cookie: `session=${cookie}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} failed ${res.status}`);
    return res.json() as Promise<T>;
  }

  return {
    getSyncPassword: (cookie) => get("/v1/me/sync-password", cookie),
    resetSyncPassword: (cookie) => post("/v1/me/sync-password/reset", cookie),
    getMe: (cookie) => get("/v1/me", cookie),
    async health() {
      try {
        const res = await fetch(`${baseUrl}/health`);
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
