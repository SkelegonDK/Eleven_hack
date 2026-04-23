import { Database } from "bun:sqlite";

declare global {
  // eslint-disable-next-line no-var
  var __poduDb: Database | undefined;
}

/**
 * Lazy getter — initializes the singleton on first call.
 *
 * PODU_DB_PATH is read HERE (not at module load) so that tests can set
 * `process.env.PODU_DB_PATH = ":memory:"` before their `import` statements
 * without worrying about ES-module hoisting re-ordering evaluation.
 */
export function getDb(): Database {
  if (globalThis.__poduDb) return globalThis.__poduDb;

  const instance = new Database(
    process.env.PODU_DB_PATH ?? "podu.db",
    { create: true },
  );
  instance.exec("PRAGMA journal_mode = WAL;");
  instance.exec("PRAGMA foreign_keys = ON;");
  migrate(instance);
  globalThis.__poduDb = instance;
  return instance;
}

function migrate(d: Database): void {
  const row = d.query("PRAGMA user_version").get() as { user_version: number };
  if (row.user_version < 1) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        content TEXT NOT NULL,
        uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        topics TEXT NOT NULL,
        started_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0
      );

      PRAGMA user_version = 1;
    `);
  }
}

/**
 * Back-compat named export. Callers (Plan 02's knowledgebase.ts) that
 * `import { db } from "../lib/db"` see a Proxy that transparently forwards
 * every property access to the lazily-initialized underlying Database.
 *
 * The Proxy is what makes the lazy-getter pattern invisible to consumers —
 * they keep writing `db.query(...)` and the singleton initializes on first
 * access, not at import time.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as Database;
