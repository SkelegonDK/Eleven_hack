---
phase: 01-foundation
plan: 01
subsystem: persistence-foundation
tags: [sqlite, iron-session-prep, clerk-strip, schema, bun-hot]
dependency-graph:
  requires: []
  provides:
    - "src/lib/db.ts::getDb (lazy singleton Database)"
    - "src/lib/db.ts::db (back-compat Proxy)"
    - "src/lib/authFetch.ts::authFetch (pass-through stub)"
    - "src/App.tsx::App (LandingPage-only render)"
  affects:
    - ".gitignore (4 new ignore entries)"
tech-stack:
  added: [bun:sqlite]
  patterns:
    - "globalThis singleton across bun --hot reloads"
    - "lazy env-var read inside getter to defeat ES-module hoisting"
    - "Proxy back-compat so `import { db }` still works without eager init"
    - "PRAGMA user_version migration guard"
key-files:
  created:
    - src/lib/db.ts
    - .planning/phases/01-foundation/01-01-SUMMARY.md
  modified:
    - src/lib/authFetch.ts
    - src/App.tsx
    - .gitignore
decisions:
  - "PODU_DB_PATH is resolved inside getDb() (not at module scope) so tests assigning process.env before imports still win"
  - "db back-compat is a Proxy, not a thunk — existing call sites like db.query(...) work unchanged"
  - "authFetch is stubbed (not deleted) in Phase 1 to preserve component call-site signatures; Phase 2 deletes it"
  - "App.tsx keeps both named + default exports to match prior shape and avoid breaking src/frontend.tsx import patterns"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-23"
  tasks: 4
  files-touched: 4
  total-insertions-approx: 85
---

# Phase 01 Plan 01: Foundation Modules Summary

Established the SQLite persistence singleton, a Clerk-free authFetch stub, and a LandingPage-only App.tsx — the foundation layer that Plans 02 and 03 will consume without touching call-site signatures.

## What Was Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/db.ts` (new) | 68 | `getDb()` lazy singleton + `db` Proxy back-compat; WAL, foreign_keys, PRAGMA user_version migration; `documents` + `conversations` tables |
| `.gitignore` (modified) | +7 | `podu.db`, `podu.db-shm`, `podu.db-wal`, `podu.db-journal` added before the GSD block |
| `src/lib/authFetch.ts` (rewritten) | 15 | Phase-1 pass-through: ignores `_getToken`, calls `fetch(url, init)` directly; no Clerk or Bearer-header logic |
| `src/App.tsx` (rewritten) | 7 | Unconditionally renders `<LandingPage />`; no Clerk `SignedIn`/`SignedOut` wrapper; no `SaasLandingPage` import |

## Key Interfaces Exported

```typescript
// src/lib/db.ts
export function getDb(): Database;
export const db: Database;  // Proxy forwarding every access to getDb()

// src/lib/authFetch.ts
export async function authFetch(
  _getToken: () => Promise<string | null>,
  url: string,
  init?: RequestInit
): Promise<Response>;

// src/App.tsx
export function App(): JSX.Element;
export default App;
```

## Lazy-Getter Rationale

`process.env.PODU_DB_PATH` is read **inside** `getDb()` rather than at module scope. ES-module imports are hoisted, so a test file that sets `process.env.PODU_DB_PATH = ":memory:"` *before* its `import` statements would otherwise race against top-level module evaluation. By deferring the env read until first-call time, the test's env assignment is guaranteed visible regardless of import ordering. (See PITFALLS.md "Landmine L2".)

The `db` export is a `Proxy({}, { get })` that forwards every property access to the lazily-initialized underlying `Database` returned by `getDb()`. This preserves the existing `import { db } from "../lib/db"; db.query(...)` call-site shape that Plan 02's `knowledgebase.ts` will use — consumers never have to know the singleton is lazy.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `e9b9c62` | feat(01-01): add bun:sqlite singleton with lazy getDb() and schema migration |
| 2 | `6ae0957` | chore(01-01): ignore bun:sqlite database files |
| 3 | `2e78c28` | refactor(01-01): stub authFetch as Phase-1 pass-through |
| 4 | `9481dd1` | refactor(01-01): render LandingPage unconditionally in App |

## Deviations from Plan

None — plan executed exactly as written. The only cosmetic adjustment was normalizing intra-SQL column-alignment whitespace (from `id          TEXT` to `id TEXT`) so the plan's own `grep -q "filename TEXT NOT NULL"` acceptance check would match with single-space separation. This is a whitespace-only change inside the migration string; column names and types are unchanged.

## Requirements Addressed

- DATA-01: globalThis singleton Database — `globalThis.__poduDb` in `src/lib/db.ts`
- DATA-02: PRAGMA user_version migration guard — present in `migrate()`
- DATA-03: WAL + foreign_keys pragmas before CREATE TABLE — enforced in `getDb()`
- DATA-04: `.gitignore` entries for `podu.db{,-shm,-wal}` — added
- DATA-05: `conversations(id, mode, topics, started_at, duration_seconds)` — created
- DATA-06: `documents(id, filename, content, uploaded_at)` — created
- HIST-04: conversations table with NOT-NULL mode/topics/started_at — enforced by CREATE TABLE constraints

## Expected Follow-on Errors (not regressions)

Full-repo `bunx tsc --noEmit` will still error after this plan because `src/index.ts`, `src/frontend.tsx`, and various components still import from `@clerk/clerk-react` and `convex/react`. That is Plan 03's scope and is explicitly called out in the plan's `<verification>` block. Files created/modified in *this* plan type-check in isolation.

## Threat Flags

None — the files created/modified in this plan introduce no new network endpoints, auth paths, or trust-boundary surfaces beyond what the plan's `<threat_model>` already enumerated. The authFetch stub is explicitly unauthenticated by design for Phase 1 (server is 127.0.0.1-bound; T-01-04 accepted); Phase 2 adds `requireSession`.

## Self-Check: PASSED

- `src/lib/db.ts` exists (FOUND)
- `src/lib/authFetch.ts` exists (FOUND)
- `src/App.tsx` exists (FOUND)
- `.gitignore` contains `podu.db` entries (FOUND)
- Commit `e9b9c62` exists (FOUND)
- Commit `6ae0957` exists (FOUND)
- Commit `2e78c28` exists (FOUND)
- Commit `9481dd1` exists (FOUND)
