// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {Database} from "bun:sqlite";
import {drizzle} from "drizzle-orm/bun-sqlite";
import {migrate} from "drizzle-orm/bun-sqlite/migrator";

const url = process.env.DATABASE_URL ?? "file:../data/anki-cloud.db";
const dbPath = url.startsWith("file:") ? url.slice(5) : url;

console.log(`Running migrations on: ${dbPath}`);

const sqlite = new Database(dbPath, {create: true});
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA foreign_keys = ON");

const db = drizzle(sqlite);
migrate(db, {migrationsFolder: `${import.meta.dir}/migrations`});

console.log("Migrations complete.");
sqlite.close();
