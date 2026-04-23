# Stack Research

**Domain:** Single-binary Bun HTTP app — SQLite persistence + iron-session secret storage
**Researched:** 2026-04-22
**Confidence:** HIGH (all key claims verified via Context7, npm registry, and official Bun docs)

---

## Context: What Changes, What Stays

This is a brownfield refactor. The goal is surgical: remove Clerk + Convex, add `bun:sqlite` + iron-session.

**Stays untouched:** Bun 1.x HTTP server, React 19, TypeScript strict, Tailwind 4, Shadcn/UI, Radix UI, ElevenLabs `@elevenlabs/react`, `ogl`, Lucide React, Playwright, `bun-plugin-tailwind`.

**Being removed:** `convex`, `@clerk/backend`, `@clerk/clerk-react`, `svix` (no more webhooks), `ai` + `@ai-sdk/react` (no AI summarization in scope).

**Being added:** `iron-session`, `bun:sqlite` (built-in — no install needed).

---

## Recommended Stack

### Core Technologies (new or changed)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `bun:sqlite` | built-in (Bun 1.x) | Conversation history + knowledge-base document storage | Zero dependency — ships with the runtime. 3-6x faster than better-sqlite3. Synchronous API matches SQLite's single-writer model cleanly. Prepared statements with named params. No config, no migration toolchain required for a 2-table demo schema. |
| `iron-session` | `^8.0.4` | Encrypted cookie storage for the ElevenLabs API key | Already planned in PROJECT.md, uses Web Crypto (works in Bun natively). Two required options: `password` (≥32 chars) and `cookieName`. Works with Bun's standard `Request`/`Response` via the `getIronSession(req, res, opts)` overload. Key is never persisted to disk or sent to the browser. |

### Stack That Stays (reference)

| Technology | Version | Notes |
|------------|---------|-------|
| Bun runtime | 1.3.10 (installed) | HTTP server via `serve()`, built-in SQLite, `--hot` dev mode |
| React | `^19` | Frontend UI — untouched |
| TypeScript | strict | Full-stack — untouched |
| Tailwind CSS | `^4.1.x` | Utility CSS — untouched |
| `bun-plugin-tailwind` | `^0.1.2` | Tailwind in Bun build pipeline — untouched |
| `@elevenlabs/react` | `^0.14.1` | WebRTC conversation SDK — core product feature |
| Shadcn/UI + Radix UI | current | Component library — untouched |
| `ogl` | `^1.0.11` | WebGL visuals — untouched |
| `lucide-react` | `^0.545.0` | Icons — untouched |
| Playwright | `^1.48.0` | E2E tests — untouched |

### Development Tools (unchanged)

| Tool | Purpose | Notes |
|------|---------|-------|
| `bun test` | Unit tests | Built-in, no Jest/Vitest needed |
| `bun --hot` | Dev server with HMR | `bun --hot src/index.ts` |
| `bunx playwright test` | E2E tests | Chromium + WebKit + Mobile |

---

## Packages to Remove

These must be uninstalled and all import sites cleaned up before the new data layer lands. Leaving them installed will cause misleading type errors and phantom env-var warnings.

| Package | Why Removed | Cleanup Required |
|---------|-------------|-----------------|
| `convex` | Entire data layer being replaced with bun:sqlite | Remove `convex/` dir, all `import { ... } from "convex/..."` and `ConvexProviderWithClerk` |
| `@clerk/backend` | Auth layer removed entirely | Delete `requireAuth`, `authenticateRequest`, Clerk client init in `src/index.ts` |
| `@clerk/clerk-react` | Frontend auth components removed | Delete `ClerkProvider`, `SignedIn`/`SignedOut`, `useAuth` from `App.tsx` / `frontend.tsx` |
| `svix` | Only used for Clerk webhook signature verification; no more webhooks | Delete `/api/webhooks/clerk` route and `src/api/billing.ts` |
| `ai` | Vercel AI SDK — no AI summarization feature in this milestone | Remove; keep `@elevenlabs/react` which is separate |
| `@ai-sdk/react` | Paired with `ai` — same reason | Remove |

---

## bun:sqlite Patterns

### How to open the database

```typescript
import { Database } from "bun:sqlite";

// Opens (or creates) the file on first run. No config needed.
const db = new Database("podu.db", { create: true });

// Always enable WAL mode — better performance, safe concurrent reads
db.run("PRAGMA journal_mode = WAL;");
```

### Schema initialization (run-once on startup)

```typescript
db.run(`
  CREATE TABLE IF NOT EXISTS conversations (
    id        TEXT PRIMARY KEY,
    mode      TEXT NOT NULL,
    topics    TEXT NOT NULL,  -- JSON array stored as text
    started_at TEXT NOT NULL,
    duration_seconds INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    content     TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
```

### Prepared statements (compile once, reuse)

```typescript
const insertConversation = db.query(
  "INSERT INTO conversations (id, mode, topics, started_at) VALUES ($id, $mode, $topics, $started_at)"
);
const listConversations = db.query(
  "SELECT id, mode, topics, started_at, duration_seconds FROM conversations ORDER BY started_at DESC"
);
```

### Migration approach: PRAGMA user_version

For a 2-table portfolio demo, a full migration library is overkill. Use SQLite's built-in version tracking:

```typescript
function migrateDb(db: Database) {
  const { user_version } = db.query("PRAGMA user_version").get() as { user_version: number };

  if (user_version < 1) {
    db.run(`CREATE TABLE IF NOT EXISTS conversations (...)`);
    db.run(`CREATE TABLE IF NOT EXISTS documents (...)`);
    db.run("PRAGMA user_version = 1");
  }
  // Add future migration blocks here: if (user_version < 2) { ... }
}
```

Call `migrateDb(db)` once at server startup, before registering routes. This handles fresh installs and future schema evolution without any migration toolchain.

---

## iron-session Patterns

### Installation

```bash
bun add iron-session
```

### Configuration

```typescript
import type { SessionOptions } from "iron-session";

export interface SessionData {
  elevenlabsApiKey?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.IRON_SESSION_SECRET_KEY!, // must be ≥32 chars
  cookieName: "podu_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // false for local dev
    sameSite: "lax",
    maxAge: undefined, // session cookie: cleared when browser closes
  },
};
```

### Reading a session in a Bun route handler

Bun's `serve()` gives you `Request` and expects you to return `Response`. iron-session v8's `getIronSession(req, res, opts)` overload works when `res` is a mutable response-like object. The cleanest pattern for Bun is to collect the `Set-Cookie` header after save and attach it to the final response:

```typescript
import { getIronSession } from "iron-session";
import type { SessionData } from "./session";
import { sessionOptions } from "./session";

// In a route handler:
async function handleSetKey(req: Request): Promise<Response> {
  const res = new Response(); // placeholder — iron-session writes Set-Cookie on it
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  const { apiKey } = await req.json();
  session.elevenlabsApiKey = apiKey;
  await session.save();

  // Carry over the Set-Cookie header iron-session wrote to `res`
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": res.headers.get("Set-Cookie") ?? "",
    },
  });
}
```

**Alternative pattern:** Use `sealData` / `unsealData` directly from iron-session to manually build and parse the cookie. This avoids the placeholder-Response dance and is equally valid for a non-Next.js environment. Recommended if the route-handler pattern above feels awkward.

```typescript
import { sealData, unsealData } from "iron-session";

// Seal the API key into an encrypted string
const sealed = await sealData({ elevenlabsApiKey: apiKey }, {
  password: process.env.IRON_SESSION_SECRET_KEY!,
  ttl: 0, // no expiry
});

// Return as a Set-Cookie header value
// ...

// Unseal on next request (parse cookie header → unseal → use key)
const data = await unsealData<{ elevenlabsApiKey: string }>(cookieValue, {
  password: process.env.IRON_SESSION_SECRET_KEY!,
  ttl: 0,
});
```

**Confidence note:** iron-session v8 is documented as Node.js/Deno/Bun compatible. The `getIronSession(req, res)` overload expects objects with compatible header interfaces. Bun's `Request` and `Response` implement the Web Fetch API spec so compatibility is expected. If any header-writing friction occurs, the `sealData`/`unsealData` pattern is the escape hatch — it has zero framework coupling.

---

## Schema Migration Approach: PRAGMA user_version

**Recommendation: Use it. Do not introduce Drizzle, Prisma, or any migration library.**

Rationale:
- The schema is 2 tables and ~10 columns total. A migration library adds 3+ new deps, a new CLI, and a `drizzle/` or `prisma/` directory for zero gain.
- `PRAGMA user_version` is built into SQLite, runs in the same `Database` instance, and requires 5 lines of code.
- The pattern scales to ~20 migrations before it starts to feel painful — well beyond what this portfolio demo will ever need.
- The only alternative worth considering would be a single `migrations.ts` file that runs SQL strings in order (similar to `bun-sqlite-migrations`), but that is still more complexity than `PRAGMA user_version` for 2 tables.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `better-sqlite3` | Node.js native module — requires native compilation, doesn't install cleanly under Bun without workarounds | `bun:sqlite` — built in, 3-6x faster, same synchronous API |
| `drizzle-orm` + `drizzle-kit` | ORM + migration CLI for a 2-table schema is overengineering; adds a dev dependency, a config file, and a shadow migration directory | Raw SQL via `bun:sqlite` prepared statements + `PRAGMA user_version` |
| `prisma` | Same as Drizzle but heavier — requires a separate binary, a Prisma schema DSL, and `prisma migrate` CLI | Raw SQL via `bun:sqlite` |
| `next-iron-session` | Legacy v6 era wrapper for Next.js Pages Router — superseded by iron-session v8 | `iron-session@^8.0.4` |
| `lucia` / `better-auth` | Full auth libraries — way beyond what's needed for "store one API key in a cookie" | `iron-session` for encrypted cookie; no auth system needed |
| `express-session` | Node.js-specific, stores sessions server-side, requires a session store — wrong model for this use case | `iron-session` (stateless, client-side encrypted cookie) |
| `@vercel/kv` / `upstash-redis` | External services — breaks the "no external dependencies" constraint | `bun:sqlite` local file |
| `sqlite3` (npm) | Async callback-based, requires native compilation, slow | `bun:sqlite` |

---

## Installation

```bash
# Remove dead dependencies
bun remove convex @clerk/backend @clerk/clerk-react svix ai @ai-sdk/react

# Add new dependency
bun add iron-session

# bun:sqlite requires no install — it's built into the runtime
```

---

## Environment Variables After Refactor

The new minimal `.env`:

```
ELEVENLABS_AGENT_ID_FUN=...
ELEVENLABS_AGENT_ID_EDU=...
ELEVENLABS_AGENT_ID_DEEP=...
IRON_SESSION_SECRET_KEY=...   # ≥32 random characters — generate once, never expose
```

The `ELEVENLABS_API_KEY` is entered at runtime by the user via the in-app dialog and stored encrypted in the session cookie — it is NOT in `.env`.

Variables to delete from `.env.example`: `CLERK_SECRET_KEY`, `VITE_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `CONVEX_URL`, `ELEVENLABS_WEBHOOK_SECRET`.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Persistence | `bun:sqlite` (built-in) | Turso (libSQL cloud) | Requires network, account, env var — breaks "clone and run" |
| Persistence | `bun:sqlite` | IndexedDB (client-side) | Can't store server-side secrets; client-only persistence |
| Secret storage | `iron-session` cookie | `.env` file for API key | Makes every user edit `.env`; breaks the portfolio UX story |
| Secret storage | `iron-session` | `localStorage` | Exposed to browser JS; security constraint explicitly rejects this |
| Migration | `PRAGMA user_version` raw SQL | `drizzle-kit` | Unnecessary for 2 tables; adds CLI dependency |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|----------------|-------|
| `iron-session` | 8.0.4 | Bun 1.x, Web Crypto API | Uses `uncrypto` for runtime-agnostic crypto; Bun ships Web Crypto natively |
| `bun:sqlite` | Built-in | Bun 1.x | No external install; API stable since Bun 0.x |
| `@elevenlabs/react` | 0.14.1 | React 19, Bun 1.x | Unchanged; WebRTC conversation SDK |

---

## Sources

- Context7 `/vvo/iron-session` — `getIronSession` API, cookie options, `sealData`/`unsealData` pattern, Node.js/Bun compatibility (HIGH confidence)
- Context7 `/oven-sh/bun` — `bun:sqlite` prepared statements, WAL mode, transactions, `PRAGMA user_version` (HIGH confidence)
- npm registry `iron-session@8.0.4` — confirmed latest version, deps: `iron-webcrypto ^1.2.1`, `uncrypto ^0.1.3`, `cookie ^0.7.2` (HIGH confidence)
- [Bun SQLite docs](https://bun.com/docs/runtime/sqlite) — official API reference (HIGH confidence)
- [oneuptime Bun SQLite guide, Jan 2026](https://oneuptime.com/blog/post/2026-01-31-bun-sqlite/view) — migration pattern with `schema_migrations` table (MEDIUM confidence)
- [bun-sqlite-migrations](https://github.com/patlux/bun-sqlite-migrations) — `PRAGMA user_version`-based migration reference (MEDIUM confidence)
- WebSearch "iron-session Bun 2025" — confirmed v8 Bun runtime support claim (MEDIUM confidence, backed by official README)

---

*Stack research for: PODU portfolio-demo Clerk+Convex removal*
*Researched: 2026-04-22*
