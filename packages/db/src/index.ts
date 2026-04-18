import {Database} from "bun:sqlite";
import {drizzle} from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/anki-cloud.db";
// bun:sqlite takes a file path, not a URI — strip the file: prefix
const path = url.startsWith("file:") ? url.slice(5) : url;

const sqlite = new Database(path, {create: true});
sqlite.run("PRAGMA journal_mode = WAL");
sqlite.run("PRAGMA busy_timeout = 5000");
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle(sqlite, {schema});

export * from "./schema";
