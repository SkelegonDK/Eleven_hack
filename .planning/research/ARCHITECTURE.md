# Architecture Research

**Domain:** Single-user voice-AI demo (Bun HTTP + React 19 + ElevenLabs WebRTC)
**Researched:** 2026-04-22
**Confidence:** HIGH — brownfield refactor with well-understood target primitives (`bun:sqlite`, `iron-session`, existing Bun `serve()` routing pattern)

---

## Standard Architecture

### System Overview (post-refactor)

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  React 19 App (frontend.tsx → App.tsx)               │    │
│  │                                                       │    │
│  │  ┌─────────────────┐  ┌──────────────────────────┐   │    │
│  │  │  ApiKeyDialog   │  │  LandingPage             │   │    │
│  │  │  (first-run /   │  │  (SubjectSelector,       │   │    │
│  │  │   invalid key)  │  │   ModeSelector,          │   │    │
│  │  └────────┬────────┘  │   ConversationView,      │   │    │
│  │           │           │   DocumentUpload)        │   │    │
│  │           │           └────────────┬─────────────┘   │    │
│  │           │                        │                  │    │
│  │           └──── POST /api/session/key ────────────┐  │    │
│  │                                   │               │  │    │
│  │                   fetch(/api/agents, /api/...)     │  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                            │ HTTP (localhost:3000)
┌──────────────────────────────────────────────────────────────┐
│  Bun HTTP Server  (src/index.ts)                             │
│                                                               │
│  ┌──────────────────────┐   ┌─────────────────────────────┐  │
│  │  requireSession()    │   │  iron-session cookie        │  │
│  │  (replaces           │   │  { elevenLabsApiKey }       │  │
│  │   requireAuth())     │   │  (sealData / unsealData)    │  │
│  └──────────┬───────────┘   └──────────────┬──────────────┘  │
│             │                              │                  │
│  ┌──────────▼───────────────────────────────▼──────────────┐  │
│  │  API Route Handlers                                      │  │
│  │  POST /api/session/key   → write cookie                  │  │
│  │  DELETE /api/session/key → clear cookie                  │  │
│  │  POST /api/agents        → build system prompt           │  │
│  │  GET  /api/agents/:id/conversation-token → ElevenLabs   │  │
│  │  GET/POST/DELETE /api/documents → SQLite knowledgebase   │  │
│  │  GET /api/conversations  → SQLite history                │  │
│  │  POST /api/conversations → SQLite history                │  │
│  │  GET /api/health         → { status: "ok" }              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────┐   ┌──────────────────────────────────┐  │
│  │  src/api/        │   │  src/lib/db.ts                   │  │
│  │  agents.ts       │   │  (module-level Database          │  │
│  │  knowledgebase.ts│   │   singleton + schema init)       │  │
│  │  conversations.ts│   └──────────────┬───────────────────┘  │
│  │  session.ts      │                  │                     │
│  └─────────────────┘                  │ bun:sqlite            │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                              podu.db (local file)
                              ┌──────────────────┐
                              │  conversations   │
                              │  documents       │
                              └──────────────────┘
                                        │
                              ElevenLabs API (external)
                              WebRTC conversation token
```

---

## Component Boundaries

| Component | Owns | Does NOT own |
|-----------|------|-------------|
| `src/lib/db.ts` | SQLite connection singleton, schema `CREATE TABLE IF NOT EXISTS`, typed query helpers | Business logic, HTTP concerns |
| `src/lib/session.ts` | `requireSession()` guard, `readApiKey()`, cookie options constant, `IRON_SESSION_OPTS` | Route registration, DB access |
| `src/api/agents.ts` | Agent ID resolution, system prompt building, ElevenLabs token fetch | Session reading (caller passes key) |
| `src/api/knowledgebase.ts` | Document CRUD via SQLite (replaces in-memory Map) | HTTP parsing (caller passes name + content) |
| `src/api/conversations.ts` | NEW — conversation history CRUD via SQLite | HTTP parsing |
| `src/index.ts` | Route registration, request parsing, response construction, middleware threading | Business logic (delegates to api/ modules) |
| `src/App.tsx` | API key gate (show ApiKeyDialog vs LandingPage) | Session cookie mechanics |
| `src/components/ApiKeyDialog.tsx` | NEW — key entry form, POST to `/api/session/key`, error display | Validation beyond HTTP error response |

---

## Detailed Data Flows

### 1. API Key Entry Flow

```
User opens app (first run or invalid key)
    ↓
App.tsx checks GET /api/session/status → { hasKey: boolean }
    ↓ (hasKey: false)
<ApiKeyDialog> renders
    ↓ user types key, clicks Submit
POST /api/session/key  { apiKey: "sk-..." }
    ↓ server: validate key format (non-empty, starts with pattern)
    ↓ server: optionally probe ElevenLabs /v1/user to confirm key is live
    ↓ server: sealData({ elevenLabsApiKey }, { password: IRON_SESSION_SECRET_KEY })
    ↓ server: Set-Cookie: podu_session=<sealed>; HttpOnly; SameSite=Lax; Path=/
Response 200 { ok: true }
    ↓
App.tsx sets hasKey: true → renders <LandingPage>
```

Key constraint: the sealed cookie value is the sole server-side storage for the API key. It is never written to `podu.db` and never returned to the browser.

### 2. Conversation Start Flow

```
User selects topics + mode → clicks Play
    ↓
POST /api/agents  { mode, subjects }
    ↓ server: requireSession(req) → reads Cookie header
    ↓ server: unsealData(cookieValue) → { elevenLabsApiKey }
    ↓ server: getAgentForMode(body) → agentId, systemPrompt, firstMessage
    ↓ (agentId + systemPrompt injected with doc context from SQLite)
Response { agentId, systemPrompt, firstMessage }
    ↓
GET /api/agents/:agentId/conversation-token
    ↓ server: requireSession(req) → elevenLabsApiKey
    ↓ server: fetch ElevenLabs /v1/convai/conversation/token with xi-api-key: elevenLabsApiKey
Response { token }
    ↓
ElevenLabs React SDK: startSession({ agentId, overrides: { agent: { prompt: systemPrompt } } })
    ↓ WebRTC connection established directly browser ↔ ElevenLabs
```

### 3. Conversation History Write Flow

```
Client: ElevenLabs onDisconnect fires (has durationSeconds)
    ↓
POST /api/conversations  { mode, agentId, durationSeconds, topics[] }
    ↓ server: requireSession(req)
    ↓ server: conversations.create({ mode, agentId, durationSeconds, topics, startedAt })
    ↓ SQLite INSERT into conversations
Response { id, startedAt }
```

### 4. History Read Flow

```
LandingPage mounts (or user visits history section)
    ↓
GET /api/conversations
    ↓ server: requireSession(req)
    ↓ server: conversations.list() → SELECT * FROM conversations ORDER BY started_at DESC
Response [{ id, mode, topics, durationSeconds, startedAt }]
    ↓
React renders conversation history list
```

### 5. Document Upload Flow

```
User opens UploadDialog, picks file
    ↓
POST /api/documents  multipart/form-data
    ↓ server: requireSession(req)
    ↓ server: parseDocumentContent(file) → string
    ↓ server: knowledgebase.create({ name, content })
    ↓ SQLite INSERT into documents
Response { id, name, uploadedAt }
    ↓
Next POST /api/agents call reads documents via knowledgebase.listAll()
(content is injected into systemPrompt — same pattern as today)
```

---

## Q&A: Specific Architecture Decisions

### Q1: Where does the SQLite connection live?

**Answer: Module-level singleton in `src/lib/db.ts`.**

Bun's `bun:sqlite` `Database` constructor opens and holds a connection. A per-request `new Database()` would open and close the file on every request — wasted syscalls, and statements cannot be prepared across requests. Module-level is the Bun-idiomatic pattern (confirmed by official Bun docs examples):

```typescript
// src/lib/db.ts
import { Database } from "bun:sqlite";

const db = new Database("podu.db", { create: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT PRIMARY KEY,
    mode       TEXT NOT NULL,
    agent_id   TEXT NOT NULL,
    topics     TEXT NOT NULL,          -- JSON array stored as text
    duration_s INTEGER NOT NULL,
    started_at TEXT NOT NULL           -- ISO 8601
  );

  CREATE TABLE IF NOT EXISTS documents (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    content     TEXT NOT NULL,
    uploaded_at TEXT NOT NULL          -- ISO 8601
  );
`);

export { db };
```

The schema `CREATE TABLE IF NOT EXISTS` runs at server startup. No migration tooling needed; for a single-file demo the schema is stable.

Prepared statements should be created once and reused:

```typescript
const insertConversation = db.prepare(
  "INSERT INTO conversations VALUES ($id, $mode, $agentId, $topics, $durationS, $startedAt)"
);
```

### Q2: How is iron-session threaded through existing route handlers in `src/index.ts`?

**Answer: Use `sealData`/`unsealData` directly, not `getIronSession`.**

`getIronSession` requires a mutable response object (it mutates `Set-Cookie` headers on `res`). Bun's `Response` objects are immutable. The lower-level `sealData`/`unsealData` API works against raw cookie strings and is the right fit for Bun's `serve()` handler model.

Pattern in `src/lib/session.ts`:

```typescript
import { sealData, unsealData } from "iron-session";

export const IRON_OPTS = {
  password: process.env.IRON_SESSION_SECRET_KEY!,
  ttl: 60 * 60 * 24 * 365,   // 1 year — demo key persists across restarts
};

export const COOKIE_NAME = "podu_session";

export interface SessionData {
  elevenLabsApiKey: string;
}

/** Read + decrypt session from cookie header. Returns null if missing/invalid. */
export async function readSession(req: Request): Promise<SessionData | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const raw = parseCookieValue(cookieHeader, COOKIE_NAME);
  if (!raw) return null;
  try {
    return await unsealData<SessionData>(raw, IRON_OPTS);
  } catch {
    return null;           // tampered or expired
  }
}

/** Guard: require valid session. Returns SessionData or a 401 Response. */
export async function requireSession(req: Request): Promise<SessionData | Response> {
  const session = await readSession(req);
  if (session) return session;
  return Response.json({ error: "API key required" }, { status: 401 });
}

/** Build a Set-Cookie header value from sealed session data. */
export async function buildSetCookieHeader(data: SessionData): Promise<string> {
  const sealed = await sealData(data, IRON_OPTS);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${sealed}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}
```

Threading into route handlers — same call-site pattern as the existing `requireAuth()`:

```typescript
// src/index.ts
import { requireSession, readSession, buildSetCookieHeader } from "./lib/session";

"/api/agents": {
  async POST(req) {
    const session = await requireSession(req);
    if (session instanceof Response) return session;
    // session.elevenLabsApiKey is now available
    const result = await getAgentForMode(req.json(), session.elevenLabsApiKey);
    return Response.json(result);
  },
},

"/api/session/key": {
  async POST(req) {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string") {
      return Response.json({ error: "apiKey required" }, { status: 400 });
    }
    const setCookie = await buildSetCookieHeader({ elevenLabsApiKey: apiKey });
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie,
      },
    });
  },
  async DELETE(_req) {
    // Expire the cookie immediately
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      },
    });
  },
},
```

The `parseCookieValue` helper is a small pure function (20 lines) that splits `Cookie:` headers — no external dep needed.

Routes to REMOVE: `/api/usage`, `/api/usage/record`, `/api/webhooks/clerk`, `/api/webhooks/elevenlabs` (or slim to a no-op stub). The Convex imports at the top of `index.ts` all disappear.

### Q3: Minimal SQLite schema for two tables

**conversations:**

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,          -- crypto.randomUUID()
  mode        TEXT NOT NULL,             -- 'fun' | 'edu' | 'deep'
  agent_id    TEXT NOT NULL,
  topics      TEXT NOT NULL,             -- JSON: '["tech","science"]'
  duration_s  INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL              -- ISO 8601 e.g. '2026-04-22T14:00:00Z'
);
```

**documents:**

```sql
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,          -- crypto.randomUUID()
  name        TEXT NOT NULL,
  content     TEXT NOT NULL,
  uploaded_at TEXT NOT NULL              -- ISO 8601
);
```

Rationale for choices:
- No `user_id` column — single-user demo; the session cookie is the identity boundary.
- `topics` as JSON text — keeps schema flat; SQLite JSON1 functions available if querying later, but for a demo list display a `JSON.parse` in application code is fine.
- `duration_s INTEGER` — seconds as integer; no precision needed; avoids float rounding.
- No indexes beyond PK — for a single-user demo with O(100) rows, full scans are imperceptible.

### Q4: Where does ApiKeyDialog live in the React component tree?

```
frontend.tsx
  └─ <React.StrictMode>
       └─ <App />
            ├─ (hasKey === false) → <ApiKeyDialog onSuccess={() => setHasKey(true)} />
            └─ (hasKey === true)  → <LandingPage />
```

`App.tsx` owns the `hasKey` state. On mount it fires `GET /api/session/status` (a new cheap endpoint that returns `{ hasKey: boolean }` by calling `readSession()` — no unsealing needed if you just test for cookie presence, or unseal and return bool). If the response is `{ hasKey: false }`, render `<ApiKeyDialog>`; otherwise render `<LandingPage>`.

`<ApiKeyDialog>` is a new component in `src/components/ApiKeyDialog.tsx`. It:
- Renders a full-screen centered dialog (Shadcn `<Dialog>` forced open).
- Has a single password `<Input>` for the API key.
- Posts `{ apiKey }` to `/api/session/key`.
- On 200: calls `onSuccess()` → App sets `hasKey: true`.
- On error: displays inline error (invalid key message from server).

`<SaasLandingPage>` and `<PricingPage>` are removed (or kept as dead files and cleaned up in a later tidy-up phase — they don't block the critical path).

The existing `src/lib/authFetch.ts` (which added Clerk Bearer tokens) is replaced or deleted. Plain `fetch()` calls are sufficient because the session cookie is sent automatically by the browser.

---

## Recommended Post-Refactor File Structure

```
src/
├── index.ts                    # Bun HTTP server — MODIFIED (remove Clerk/Convex, add session routes)
├── index.html                  # HTML template — MODIFIED (remove Clerk key injection)
├── frontend.tsx                # React entry — MODIFIED (remove ClerkProvider + ConvexProvider)
├── App.tsx                     # Root component — REWRITTEN (hasKey gate replaces Clerk SignedIn/Out)
├── lib/
│   ├── db.ts                   # NEW — bun:sqlite singleton + schema init
│   ├── session.ts              # NEW — iron-session sealData/unsealData helpers, requireSession()
│   └── utils.ts                # UNCHANGED
├── api/
│   ├── agents.ts               # MODIFIED — accept apiKey param instead of reading from env
│   ├── agentPrompts.ts         # UNCHANGED
│   ├── knowledgebase.ts        # REWRITTEN — replace in-memory Map with SQLite via db.ts
│   ├── conversations.ts        # NEW — SQLite CRUD for conversation history
│   ├── auditAgents.ts          # UNCHANGED
│   ├── auditAgents.cli.ts      # UNCHANGED
│   ├── usage.ts                # DELETED
│   ├── billing.ts              # DELETED
│   └── __tests__/
│       ├── agents.test.ts      # UPDATE (mock apiKey param)
│       ├── knowledgebase.test.ts  # UPDATE (test SQLite path)
│       ├── conversations.test.ts  # NEW
│       └── agentPrompts.test.ts   # UNCHANGED
└── components/
    ├── ApiKeyDialog.tsx         # NEW — key entry form
    ├── LandingPage.tsx          # MODIFIED — remove UsageMeter, Clerk hooks
    ├── ConversationView.tsx     # MODIFIED — call /api/conversations POST on disconnect
    ├── SubjectSelector.tsx      # UNCHANGED
    ├── ModeSelector.tsx         # UNCHANGED
    ├── DocumentUpload.tsx       # UNCHANGED (API contract same, backend changes)
    ├── UploadDialog.tsx         # UNCHANGED
    ├── Aurora.tsx               # UNCHANGED
    ├── LightRays.tsx            # UNCHANGED
    ├── SaasLandingPage.tsx      # DELETE (or leave as dead file; remove from imports)
    ├── PricingPage.tsx          # DELETE
    ├── UsageMeter.tsx           # DELETE
    └── ui/                      # UNCHANGED (Shadcn primitives)
convex/                          # DELETE entire directory
```

---

## Build Order with Dependencies

### Phase ordering rationale

The biggest risk in this refactor is having a period where the app is broken for both old reasons (Clerk/Convex removed) and new reasons (SQLite/session not yet wired). The safest strategy is: **replace the auth/session layer first, then replace the data layer, then clean up dead code**.

```
Phase 1 — Foundation (blocks everything else)
  1a. Add iron-session dependency (bun add iron-session)
  1b. Create src/lib/session.ts  (requireSession, buildSetCookieHeader)
  1c. Create src/lib/db.ts       (singleton, CREATE TABLE IF NOT EXISTS)
  1d. Create src/api/conversations.ts (CRUD over db.ts)
  1e. Rewrite src/api/knowledgebase.ts (Map → SQLite via db.ts)

Phase 2 — Server wiring (depends on Phase 1; blocks Phase 3)
  2a. Rewrite src/index.ts:
      - Remove Clerk imports, requireAuth(), clerkClient
      - Remove Convex imports, checkUsage, recordUsage, syncClerkPlan
      - Remove webhook routes (clerk, elevenlabs)
      - Remove usage routes
      - Add requireSession() guard on all protected routes
      - Add POST /api/session/key, DELETE /api/session/key, GET /api/session/status
      - Add GET /api/conversations, POST /api/conversations
      - Update Bun.build define: remove VITE_PUBLIC_CLERK_PUBLISHABLE_KEY, VITE_CONVEX_URL
  2b. Modify src/api/agents.ts:
      - getConversationToken(agentId, apiKey) — accept key as param, not env var
      - getAgentForMode remains unchanged (env vars for agent IDs stay)

Phase 3 — Frontend gate (depends on Phase 2)
  3a. Create src/components/ApiKeyDialog.tsx
  3b. Rewrite src/App.tsx (hasKey state, GET /api/session/status, render gate)
  3c. Modify src/frontend.tsx (remove ClerkProvider, ConvexProviderWithClerk)
  3d. Modify src/index.html (remove Clerk publishable key script injection)
  3e. Delete src/lib/authFetch.ts (or replace with plain fetch wrapper)
  3f. Modify src/components/LandingPage.tsx (remove useAuth, UsageMeter, Clerk hooks)
  3g. Modify src/components/ConversationView.tsx (POST /api/conversations on disconnect)

Phase 4 — Cleanup (can run in parallel with Phase 3; blocks final verification)
  4a. Delete convex/ directory
  4b. Delete src/api/usage.ts, src/api/billing.ts
  4c. Delete src/components/SaasLandingPage.tsx, PricingPage.tsx, UsageMeter.tsx
  4d. Remove Clerk + Convex + Svix from package.json
  4e. Update .env.example: remove Clerk/Convex vars, add IRON_SESSION_SECRET_KEY
  4f. Update README + APP_FLOW.md

Phase 5 — Verification (depends on Phases 1-4)
  5a. Update Playwright tests: replace Clerk auth setup with API key entry flow
  5b. Update unit tests: agents.test.ts (apiKey param), knowledgebase.test.ts (SQLite)
  5c. Full end-to-end: bun dev → enter key → pick topics → conversation → history updates
```

### Dependency chain summary

```
db.ts + session.ts
    ↓
knowledgebase.ts rewrite + conversations.ts (new)
    ↓
index.ts rewrite (server compiles and routes work)
    ↓
App.tsx + ApiKeyDialog.tsx (frontend gate works)
    ↓
LandingPage + ConversationView modifications
    ↓
package.json cleanup + env update
    ↓
Tests pass
```

Phases 3d (index.html), 4a-4f (cleanup), and parts of Phase 3 can be done in parallel once Phase 2 is complete — they are independent file changes with no cross-dependencies.

---

## Migration Bridges and Risk Flags

### Risk 1: Removing Clerk BEFORE iron-session gate is in place

**Consequence:** The server starts but all `/api/*` routes are unprotected. Anyone hitting `localhost:3000/api/agents` gets a response without a key check. For a local demo this is low-stakes, but if a developer accidentally runs it while `ELEVENLABS_API_KEY` is in `.env`, the env key is used directly.

**Mitigation:** Phase 2a must land atomically — do not merge a partial `index.ts` that has Clerk removed but `requireSession` not yet wired. The safest git commit unit is: remove `requireAuth` AND add `requireSession` AND add session routes in the same commit.

**Bridge option:** During development, keep a temporary `requireApiKey(req)` stub that returns a hardcoded dev key from env. This lets the server run and be tested before the session cookie flow is fully implemented in the frontend.

### Risk 2: Removing Convex BEFORE SQLite is wired up

**Consequence:** `knowledgebase.ts` currently uses an in-memory Map (so removing Convex imports doesn't actually break it — the Map path already works). `conversations.ts` doesn't exist yet (usage tracking was Convex-only). So Convex removal doesn't break the core conversation flow.

**Mitigation:** Delete the `convex/` directory only after `src/lib/db.ts` is in place and `knowledgebase.ts` has been rewritten. Document storage is the only persistent data path that existed before — and it was already in-memory, so the gap is smaller than it looks.

### Risk 3: iron-session `sealData`/`unsealData` vs `getIronSession`

**Consequence:** The `getIronSession` API mutates `res` headers and is designed for Node.js `ServerResponse` / Next.js API response objects. Bun's `Response` is immutable (Web API spec). Using `getIronSession` with Bun's response would require a workaround shim.

**Mitigation:** Use `sealData`/`unsealData` throughout. These are the lower-level primitives that `getIronSession` itself calls internally. They accept/return strings, not request/response objects, and integrate cleanly with Bun's handler model. Confidence: HIGH (verified against iron-session docs).

### Risk 4: ElevenLabs API key validation on entry

Two options:
- **Lightweight:** Only validate that the key is non-empty and matches a string format. Zero network call. Risk: user enters a valid-looking but wrong key and sees a confusing error later at conversation start.
- **Probing:** POST `/api/session/key` fires `GET https://api.elevenlabs.io/v1/user` with the key. If 401, return `{ error: "Invalid ElevenLabs API key" }`. Adds ~200ms latency on first entry only. Strongly recommended for recruiter UX — failure is surfaced immediately with a clear message.

**Recommendation:** Probe. The latency is worth the UX clarity.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Per-request SQLite connection

**What people do:** `new Database("podu.db")` inside each route handler to avoid "global state."
**Why it's wrong:** Opens and closes the file every request; cannot use prepared statements efficiently; risks write contention if two requests overlap.
**Do this instead:** Module-level singleton in `src/lib/db.ts` — one connection, shared across all routes.

### Anti-Pattern 2: Storing the API key in SQLite

**What people do:** Insert the key into a `settings` table so it "survives server restarts."
**Why it's wrong:** The key is plaintext on disk. The security model for this demo is: key lives only in the encrypted cookie. If the server restarts, the browser re-sends the cookie and the key is decrypted server-side on the next request — no disk persistence needed.
**Do this instead:** Cookie-only. The iron-session cookie persists in the browser. Browser clears it → user re-enters the key. That's the intended flow.

### Anti-Pattern 3: Sending the API key back to the client

**What people do:** Return `{ apiKey }` from `/api/session/status` to avoid the browser needing to store it.
**Why it's wrong:** The entire point of the iron-session cookie is that the key never travels to the client after being stored. Exposing it defeats the model.
**Do this instead:** `/api/session/status` returns only `{ hasKey: boolean }`. The key stays server-side.

### Anti-Pattern 4: Removing Clerk from `package.json` before verifying the frontend compiles

**What people do:** `bun remove @clerk/clerk-react @clerk/backend` as the first step.
**Why it's wrong:** TypeScript imports of Clerk symbols in `App.tsx`, `frontend.tsx`, and `authFetch.ts` will fail to compile, blocking `Bun.build`. The transpiled bundle stops serving.
**Do this instead:** Remove Clerk imports from all source files first, verify `bun dev` starts cleanly, then remove the packages.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| ElevenLabs API | Server-side HTTP with `xi-api-key: <key from session cookie>` | Key read from cookie on every token request; never touches client |
| ElevenLabs WebRTC | Browser SDK (`@elevenlabs/react`) with token from `/api/agents/:id/conversation-token` | No change to this flow |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `index.ts` ↔ `lib/session.ts` | Direct function call — `requireSession(req)` | Returns `SessionData | Response` (same discriminated union as old `requireAuth`) |
| `index.ts` ↔ `lib/db.ts` | Via `api/` modules only — `index.ts` does not import `db` directly | Keeps route handlers thin |
| `api/agents.ts` ↔ ElevenLabs | `fetch()` with caller-supplied key | Key passed as parameter, not from `process.env` (env `ELEVENLABS_API_KEY` is removed from this file) |
| `api/knowledgebase.ts` ↔ `lib/db.ts` | Direct import of `db` singleton | Module boundary: knowledgebase owns document SQL |
| `api/conversations.ts` ↔ `lib/db.ts` | Direct import of `db` singleton | Module boundary: conversations owns conversation SQL |
| React `App.tsx` ↔ server | `fetch("/api/session/status")` on mount | Determines which view to render |
| `ApiKeyDialog` ↔ server | `fetch("/api/session/key", { method: "POST" })` | Sets `HttpOnly` cookie; response is just `{ ok: true }` |

---

## Sources

- Bun `bun:sqlite` module docs and server examples (Context7 / official Bun docs, 2026) — HIGH confidence
- iron-session `sealData`/`unsealData` API docs (Context7 / github.com/vvo/iron-session README, 2026) — HIGH confidence
- Existing codebase: `src/index.ts`, `src/api/agents.ts`, `src/api/knowledgebase.ts`, `src/App.tsx` — directly inspected

---

*Architecture research for: PODU portfolio-demo refactor (brownfield)*
*Researched: 2026-04-22*
