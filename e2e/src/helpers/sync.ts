// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
/**
 * Minimal Anki sync protocol client.
 *
 * Sync version 11: body = zstd-compressed JSON, auth in `anki-sync` header.
 * HostKeyRequest fields use short names: u (username), p (password).
 * SyncHeader fields: v (version), k (hkey), c (client_version), s (session_key).
 */
import { compress, decompress } from "@mongodb-js/zstd";

const SYNC_VERSION = 11;
const CLIENT_VERSION = "anki-cloud-e2e/1.0";

export interface SyncClient {
  hostKey(username: string, password: string): Promise<string>;
  meta(hkey: string, skey: string): Promise<Record<string, unknown>>;
  healthCheck(): Promise<boolean>;
}

export function makeSyncClient(baseUrl: string): SyncClient {
  async function post(
    path: string,
    body: unknown,
    hkey: string,
    skey = ""
  ): Promise<unknown> {
    const json = JSON.stringify(body);
    const compressed = await compress(Buffer.from(json));

    const header = JSON.stringify({
      v: SYNC_VERSION,
      k: hkey,
      c: CLIENT_VERSION,
      s: skey,
    });

    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "anki-sync": header,
        "content-type": "application/octet-stream",
      },
      body: compressed as unknown as BodyInit,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sync request failed ${res.status}: ${text}`);
    }

    const buf = await res.arrayBuffer();
    const decompressed = await decompress(Buffer.from(buf));
    return JSON.parse(decompressed.toString("utf8"));
  }

  return {
    async hostKey(username, password) {
      const resp = (await post(
        "/sync/hostKey",
        { u: username, p: password },
        ""
      )) as { key: string };
      return resp.key;
    },

    async meta(hkey, skey) {
      return (await post(
        "/sync/meta",
        { v: SYNC_VERSION, cv: CLIENT_VERSION },
        hkey,
        skey
      )) as Record<string, unknown>;
    },

    async healthCheck() {
      try {
        const res = await fetch(`${baseUrl}/health`);
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
