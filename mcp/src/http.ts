// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isCredentialValid, withApiKey } from "./client.js";
import { createServer } from "./server.js";

const MAX_BODY_BYTES = 1_000_000;

// OAuth discovery (RFC 9728). Enabled when both are set; the issuer is the REST API's authorization server.
const PUBLIC_URL = process.env["MCP_PUBLIC_URL"]?.replace(/\/+$/, "");
const OAUTH_ISSUER = process.env["OAUTH_ISSUER"]?.replace(/\/+$/, "");
const RESOURCE_METADATA_URL = PUBLIC_URL && OAUTH_ISSUER ? `${PUBLIC_URL}/.well-known/oauth-protected-resource` : null;

function unauthenticatedHeaders(): Record<string, string> {
  return {
    "WWW-Authenticate": RESOURCE_METADATA_URL ? `Bearer resource_metadata="${RESOURCE_METADATA_URL}"` : "Bearer",
  };
}

// Browser-based MCP clients need CORS. Credentials are never allowed, so any origin may call.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

function rpcError(res: ServerResponse, status: number, code: number, message: string, headers?: Record<string, string>) {
  sendJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null }, headers);
}

function bearerToken(req: IncomingMessage): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  return match?.[1] ?? null;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const apiKey = bearerToken(req);
  if (!apiKey) {
    return rpcError(res, 401, -32001, "Missing bearer token", unauthenticatedHeaders());
  }
  // Reject bad, revoked or expired credentials with a real 401 so OAuth clients know to refresh or re-authorize.
  if (!(await isCredentialValid(apiKey))) {
    return rpcError(res, 401, -32001, "Invalid or expired credential", {
      ...unauthenticatedHeaders(),
      "WWW-Authenticate": `${unauthenticatedHeaders()["WWW-Authenticate"]}, error="invalid_token"`,
    });
  }
  if (req.method !== "POST") {
    // Stateless mode: no server-initiated streams and no sessions to terminate.
    return rpcError(res, 405, -32000, "Method not allowed", { Allow: "POST" });
  }

  let body: unknown;
  try {
    body = await readJson(req);
  } catch (err) {
    const tooLarge = err instanceof Error && err.message === "body too large";
    return rpcError(res, tooLarge ? 413 : 400, tooLarge ? -32000 : -32700, tooLarge ? "Body too large" : "Parse error");
  }

  // A fresh server and transport per request keeps the process stateless, so it scales horizontally.
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await withApiKey(apiKey, () => transport.handleRequest(req, res, body));
  } catch (err) {
    console.error("mcp request failed", err);
    if (!res.headersSent) rpcError(res, 500, -32603, "Internal server error");
  }
}

export function startHttpServer(port: number): void {
  const httpServer = createHttpServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    for (const [name, value] of Object.entries(CORS_HEADERS)) res.setHeader(name, value);
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Max-Age": "86400" });
      return void res.end();
    }
    if (path === "/healthz") return sendJson(res, 200, { ok: true });
    if (RESOURCE_METADATA_URL && path.startsWith("/.well-known/oauth-protected-resource")) {
      return sendJson(res, 200, {
        resource: `${PUBLIC_URL}/mcp`,
        authorization_servers: [OAUTH_ISSUER],
        bearer_methods_supported: ["header"],
        scopes_supported: ["openid", "offline_access"],
      });
    }
    if (path === "/mcp") return void handleMcp(req, res);
    sendJson(res, 404, { error: "not found" });
  });
  httpServer.listen(port, () => console.error(`anki-cloud MCP listening on :${port} (streamable HTTP, /mcp)`));
}
