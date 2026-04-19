// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
const BASE = "/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        credentials: "include",
        headers: {"Content-Type": "application/json", ...options?.headers},
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({error: "Request failed"}));
        throw Object.assign(new Error(body.error || "Request failed"), {status: res.status});
    }
    return res.json();
}

export type User = {
    id: string;
    email: string | null;
    name: string | null;
    createdAt: string;
};

export type StorageConnection = {
    id: string;
    provider: "gdrive" | "dropbox" | "s3";
    folderPath: string;
    connectedAt: string;
};

export type ApiKey = {
    id: string;
    label: string;
    lastUsedAt: string | null;
    createdAt: string;
};

export type NewApiKey = {
    id: string;
    label: string;
    key: string;
    createdAt: string;
};

export const getMe = () => request<User>("/me");

export const getStorage = () =>
    request<{ connections: StorageConnection[] }>("/me/storage");

export const disconnectStorage = (provider: string) =>
    request<{ ok: boolean }>(`/me/storage/${provider}`, {method: "DELETE"});

export const updateStorageFolderPath = (provider: string, folderPath: string) =>
    request<{ ok: boolean }>(`/me/storage/${provider}`, {
        method: "PUT",
        body: JSON.stringify({folderPath}),
    });

export const getApiKeys = () => request<{ apiKeys: ApiKey[] }>("/me/api-keys");

export const createApiKey = (label: string) =>
    request<NewApiKey>("/me/api-keys", {
        method: "POST",
        body: JSON.stringify({label}),
    });

export const revokeApiKey = (id: string) =>
    request<{ ok: boolean }>(`/me/api-keys/${id}`, {method: "DELETE"});

export type SyncCredentials = {
    username: string | null;
    password: string | null;
};

export const getSyncPassword = () => request<SyncCredentials>("/me/sync-password");

export const resetSyncPassword = () =>
    request<SyncCredentials>("/me/sync-password/reset", {method: "POST"});
