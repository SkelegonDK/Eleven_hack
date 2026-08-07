/**
 * Preloaded by `bun test` (see bunfig.toml `[test] preload`).
 *
 * Points the bun:sqlite singleton at an in-memory database BEFORE any test
 * file — and therefore any `import { db } from "./lib/db"` — is evaluated.
 * Without this, tests would open and write the real ./podu.db in the repo
 * root, leaking test rows into the developer's local library.
 *
 * src/lib/db.ts reads PODU_DB_PATH lazily on first use rather than at module
 * load, so this assignment is guaranteed to be seen.
 */
process.env.PODU_DB_PATH = ":memory:";
