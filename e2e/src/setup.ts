import { tmpdir } from "os";
import { join } from "path";
import { mkdtempSync, rmSync } from "fs";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const MIGRATIONS_DIR = join(import.meta.dir, "../../packages/db/src/migrations");
const API_ENTRY = join(import.meta.dir, "../../packages/api/src/index.ts");
const SYNC_BIN = join(import.meta.dir, "../../anki-sync-server/target/debug/anki-sync-server");

// 32-byte all-zeros key (hex) — test only
export const TEST_ENCRYPTION_KEY = "0".repeat(64);
export const TEST_JWT_SECRET = "0".repeat(64);
export const TEST_GOOGLE_CLIENT_ID = "test-client-id";
export const TEST_GOOGLE_CLIENT_SECRET = "test-client-secret";

export interface TestStack {
  dbPath: string;
  apiPort: number;
  syncPort: number;
  syncBase: string;
  cleanup: () => Promise<void>;
}

export async function startStack(): Promise<TestStack> {
  const dir = mkdtempSync(join(tmpdir(), "anki-cloud-e2e-"));
  const dbPath = join(dir, "test.db");
  const syncBase = join(dir, "sync");

  // Run migrations on temp DB
  const sqlite = new Database(dbPath, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  sqlite.close();

  const apiPort = await freePort();
  const syncPort = await freePort();

  const env: Record<string, string> = {
    DATABASE_URL: `file:${dbPath}`,
    TOKEN_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    JWT_SECRET: TEST_JWT_SECRET,
    GOOGLE_CLIENT_ID: TEST_GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: TEST_GOOGLE_CLIENT_SECRET,
    PORT: String(apiPort),
    SYNC_PORT: String(syncPort),
    SYNC_BASE: syncBase,
  };

  // Start API server
  const apiProc = Bun.spawn(["bun", "run", API_ENTRY], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  // Start Rust sync server
  const syncProc = Bun.spawn([SYNC_BIN], {
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });

  await waitForHttp(`http://localhost:${apiPort}/health`);
  await waitForHttp(`http://localhost:${syncPort}/health`);

  const cleanup = async () => {
    apiProc.kill();
    syncProc.kill();
    await apiProc.exited;
    await syncProc.exited;
    rmSync(dir, { recursive: true, force: true });
  };

  return { dbPath, apiPort, syncPort, syncBase, cleanup };
}

async function waitForHttp(url: string, maxMs = 15_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function freePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = server.port!;
  server.stop();
  return port;
}
