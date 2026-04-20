// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
/** Typed REST API client for e2e tests. */

export interface ApiClient {
  getSyncPassword(sessionToken: string): Promise<SyncCredentials>;
  resetSyncPassword(sessionToken: string): Promise<SyncCredentials>;
  getMe(sessionToken: string): Promise<MeResponse>;
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
  async function get<T>(path: string, sessionToken: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { cookie: `better-auth.session_token=${sessionToken}` },
    });
    if (!res.ok) throw new Error(`GET ${path} failed ${res.status}`);
    return res.json() as Promise<T>;
  }

  async function post<T>(path: string, sessionToken: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        cookie: `better-auth.session_token=${sessionToken}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} failed ${res.status}`);
    return res.json() as Promise<T>;
  }

  return {
    getSyncPassword: (token) => get("/v1/me/sync-password", token),
    resetSyncPassword: (token) => post("/v1/me/sync-password/reset", token),
    getMe: (token) => get("/v1/me", token),
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
