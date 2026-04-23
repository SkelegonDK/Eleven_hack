# Project Research Summary

**Project:** PODU — portfolio-demo refactor (Clerk + Convex removal)
**Domain:** Single-user voice-AI demo (Bun HTTP + React 19 + ElevenLabs WebRTC)
**Researched:** 2026-04-22
**Confidence:** HIGH

## Executive Summary

PODU is a brownfield refactor, not a greenfield build. The hackathon SaaS scaffolding (Clerk auth, Convex BaaS, usage tracking, billing webhooks) is being surgically removed and replaced with two primitives: `bun:sqlite` for local persistence and `iron-session` encrypted cookies for API key storage. The result is a zero-external-dependency demo where a recruiter clones the repo, runs `bun dev`, pastes their ElevenLabs key into an in-app dialog, and has a genuine voice conversation within five minutes. Every architectural choice is subordinate to that constraint.

The recommended approach is a strict phase sequence: strip the data layer first (replace in-memory knowledgebase Map with SQLite before removing Convex), then wire the session layer (iron-session `sealData`/`unsealData` — not `getIronSession`, which is incompatible with Bun's immutable `Response`), then replace the frontend auth gate (Clerk providers out, `ApiKeyDialog` in). Cleanup and test updates follow. This order prevents a period where the app is broken for both old and new reasons simultaneously.

The critical risks are security and UX, not technical complexity. The API key must never reach the browser bundle (no `Bun.build` `define` entry for it), `secure: true` on the cookie must be conditioned on `NODE_ENV === "production"` to avoid silent HTTP failures in dev, and the ElevenLabs API key must be validated against `/v1/user` at submission time so a bad key surfaces at setup rather than mid-demo as a cryptic WebRTC 401.

---

## Key Findings

### Stack at a Glance

This is a minimal dependency swap. Two packages are added; six are removed.

**Add:**
- `iron-session@^8.0.4` — encrypted cookie storage for the ElevenLabs API key. Use `sealData`/`unsealData` (lower-level primitives), not `getIronSession`, because Bun's `Response` is immutable. `IRON_SESSION_SECRET_KEY` must be >= 32 chars; validate at startup before `serve()`.
- `bun:sqlite` (built-in, no install) — zero-config SQLite. Module-level singleton on `globalThis` to survive `bun --hot` reloads without leaking file handles. WAL mode required.

**Remove:**
- `convex` — entire data layer gone; `convex/` directory deleted; `ConvexProviderWithClerk` gone from `frontend.tsx`
- `@clerk/backend` + `@clerk/clerk-react` — auth layer gone; `ClerkProvider`, `requireAuth()`, `useAuth` all deleted
- `svix` — Clerk webhook verifier; `/api/webhooks/clerk` route deleted
- `ai` + `@ai-sdk/react` — no AI summarization in this milestone

**Stays untouched:** Bun 1.3.10, React 19, TypeScript strict, Tailwind 4, Shadcn/UI, `@elevenlabs/react@^0.14.1`, `ogl`, Playwright.

**New `.env` surface (only 4 vars):** `ELEVENLABS_AGENT_ID_FUN`, `ELEVENLABS_AGENT_ID_EDU`, `ELEVENLABS_AGENT_ID_DEEP`, `IRON_SESSION_SECRET_KEY`. The ElevenLabs API key is NOT in `.env` — it is entered at runtime and stored only in the encrypted session cookie.

### Feature Landscape

**Table stakes — blocks MVP:**
- API key entry dialog (first-run + re-entry on 401) — the setup story lives or dies here
- Encrypted iron-session cookie for API key — never persisted to disk, never sent to client
- ElevenLabs key validation at submission (`GET /v1/user`) — surfaces failure at setup, not at WebRTC start
- SQLite-backed conversation history (mode, topics, timestamp, duration) — proves app is stateful
- SQLite-backed knowledge-base document storage — replaces in-memory Map that resets on restart
- Remove Clerk, Convex, UsageMeter, usage/billing routes — clearing friction that breaks "clone and run"
- Preserved visual polish (Aurora, LightRays, mode-color theming, reduced-motion) — already impressive; do not break in refactor

**Differentiators — elevates demo:**
- Three highly-distinct host personalities with anti-sycophancy rules (`agentPrompts.ts` is already exceptional)
- Topic pinning wired into system prompt — low effort, high craft signal
- VAD-score-driven audio visualizer — replaces `Math.random()` bars; noticeable quality signal
- Conversation history UI panel with mode badge and topic list

**Anti-features — explicitly excluded:**
- Clerk auth, Convex, UsageMeter, billing webhooks — setup friction, zero portfolio value
- Live transcription — requires separate ASR; ElevenLabs React SDK has no word-level real-time stream
- Post-call summary — requires second LLM key; breaks single-key constraint; defer
- URL-param or localStorage API key storage — security anti-pattern; explicitly rejected in PROJECT.md
- Agent configuration UI — ElevenLabs dashboard handles this; agent IDs stay in env vars
- Production deployment infra — local `bun dev` is canonical this milestone

### Architecture Shape

The post-refactor shape is a single-binary Bun HTTP server with two new lib modules (`src/lib/db.ts` as the SQLite singleton, `src/lib/session.ts` as the iron-session helpers), two updated API modules (`src/api/conversations.ts` new, `src/api/knowledgebase.ts` rewritten), and one new React component (`ApiKeyDialog`). `App.tsx` gains a `hasKey` state gate that checks `GET /api/session/status` on mount and renders `<ApiKeyDialog>` until a valid key is stored; afterward it renders `<LandingPage>` unchanged. All protected routes replace `requireAuth()` with `requireSession(req)` — same discriminated union return type, minimal call-site churn. The ElevenLabs API key flows: user entry via dialog -> `POST /api/session/key` -> `sealData` -> `HttpOnly` cookie -> `unsealData` on every protected request -> `xi-api-key` header in server-side ElevenLabs fetch. The key never touches the browser after the initial POST body.

**Critical build order (each step depends on the previous):**
1. `src/lib/db.ts` + `src/lib/session.ts` — nothing compiles without these
2. `src/api/conversations.ts` (new) + `src/api/knowledgebase.ts` (rewritten to SQLite)
3. `src/index.ts` rewrite — remove Clerk/Convex imports, wire `requireSession`, add session/conversation routes
4. `src/api/agents.ts` — accept `apiKey` as parameter instead of reading from env
5. `src/components/ApiKeyDialog.tsx` (new) + `src/App.tsx` rewrite (hasKey gate)
6. `src/frontend.tsx` + `src/index.html` — remove providers; remove Clerk key injection
7. `src/components/LandingPage.tsx` + `ConversationView.tsx` — remove Clerk hooks, wire history POST on disconnect
8. Dependency + env cleanup, delete dead files/components
9. Tests — update Playwright and unit tests for new auth model

### Top 5 Pitfalls

1. **API key exposed in Bun.build `define` block** — Never add `ELEVENLABS_API_KEY` to the `define` object in `src/index.ts`. The existing block already injects frontend env vars; it is the natural-but-wrong location. Enforce via `grep -r "ELEVENLABS_API_KEY" src/frontend.tsx src/components/` before completing Phase 2.

2. **`getIronSession` incompatible with Bun's immutable `Response`** — `getIronSession(req, res)` mutates `res` headers and is designed for Node.js `ServerResponse`. Bun's `Response` is immutable (Web API spec). Use `sealData`/`unsealData` throughout `src/lib/session.ts` — these accept/return strings, have zero framework coupling.

3. **`secure: true` cookie silently breaks HTTP localhost dev** — Browsers refuse to send a `Secure` cookie over plain HTTP. Every protected route returns 401 with no obvious cause; the `Set-Cookie` header is emitted but the cookie never round-trips. Fix: `cookieOptions: { secure: process.env.NODE_ENV === "production" }`. Verify cookie round-trip over HTTP before declaring Phase 2 done.

4. **SQLite opened multiple times during `bun --hot` reloads** — A bare module-level `const db = new Database(...)` reopens the file on every hot reload; file descriptors accumulate; `SQLITE_BUSY` errors appear. Fix: `globalThis.__db ??= new Database("podu.db")` with `import.meta.hot?.dispose(...)` cleanup. WAL mode (`PRAGMA journal_mode = WAL`) immediately after open is also required.

5. **WebRTC system-prompt override silently discarded on empty string** — If `buildFullPrompt()` returns empty (e.g., knowledgebase not yet ported), the SDK sends `overrides.agent.prompt.prompt = ""` and the agent silently ignores selected topics. Guard: assert `systemPrompt.length > 0` in `getAgentForMode()` before returning; only include `prompt` key in overrides when the value is non-empty.

**Also critical:**
- Orphaned Clerk/Convex TypeScript imports break `bun build` after package removal — remove packages first, fix compiler errors second (forces complete audit of all import sites)
- Document persistence lost if `knowledgebase.ts` in-memory Map is not ported to SQLite atomically with Convex removal
- PDF upload silently produces placeholder text in the system prompt — restrict accepted types to `.txt`/`.md` in Phase 1; return 400 for PDFs

---

## Implications for Roadmap

Research points to a 4-phase structure. Phases 1 and 2 are strictly ordered by technical dependency. Phase 3 can partially overlap late Phase 2. Phase 4 is independent cleanup that unlocks final verification.

### Phase 1: Foundation — Strip Dead Dependencies, Add Data Layer

**Rationale:** The in-memory knowledgebase Map and Convex data layer must be replaced before anything else. Removing Clerk packages before clearing their import sites breaks TypeScript compilation — so packages come out first, which forces a complete import audit. Removing Convex without SQLite in place leaves document uploads broken.

**Delivers:** Compilable codebase with SQLite persistence, Clerk and Convex fully absent from `package.json` and all imports, knowledgebase and conversation history working via `bun:sqlite`.

**Addresses:** SQLite-backed conversation history, SQLite-backed knowledge-base document storage, Clerk/Convex/UsageMeter/billing removal.

**Avoids:** Orphaned-import build breaks, knowledgebase persistence loss, PDF placeholder bug (restrict upload types here).

### Phase 2: Session Layer — Iron-Session + API Key Dialog

**Rationale:** With the data layer in place, the session boundary can be wired. `requireSession()` replaces `requireAuth()` across all route handlers. The API key dialog is the new front door and must validate the key against ElevenLabs before storing it.

**Delivers:** `POST /api/session/key` (with ElevenLabs `/v1/user` probe), `DELETE /api/session/key`, `GET /api/session/status`; `requireSession()` guard on all protected routes; `ApiKeyDialog` component; `App.tsx` hasKey gate; providers removed from `frontend.tsx` and `index.html`.

**Addresses:** API key entry dialog, encrypted iron-session cookie storage, ElevenLabs key validation, microphone permission error UX.

**Avoids:** `getIronSession` incompatibility, `secure: true` HTTP dev breakage, API key in Bun.build define, weak session secret (startup length guard before `serve()`).

### Phase 3: Polish and Differentiators

**Rationale:** Once the core flow (key entry -> topic selection -> conversation -> history) is end-to-end verified, layer craft signals that elevate the demo above a functional prototype.

**Delivers:** Topic pinning wired into system prompt; visual polish verified unbroken; conversation history UI panel; VAD-score audio visualizer replacing `Math.random()` bars; `ConversationView` posts history on disconnect.

**Addresses:** Topic pinning -> system prompt, conversation history UI, VAD-score visualizer, reduced-motion preservation.

**Avoids:** Breaking Aurora/LightRays/mode-color theming during LandingPage and ConversationView modifications.

### Phase 4: Cleanup, Docs, and Verification

**Rationale:** Dead files and docs are low-risk but must be correct before milestone closes. Playwright tests verify the full recruiter journey.

**Delivers:** Clean `.env.example` (4 vars only), updated README and APP_FLOW.md, deleted dead components (`SaasLandingPage.tsx`, `PricingPage.tsx`, `UsageMeter.tsx`), updated unit tests, passing Playwright E2E (enter key -> pick topics + host -> WebRTC conversation -> history updates -> history persists across server restart).

**Avoids:** "Looks done but isn't" — verify against the 13-point checklist in PITFALLS.md before declaring done.

### Phase Ordering Rationale

- Phase 1 before Phase 2: SQLite must exist before session routes can inject document context into system prompts. Clerk/Convex must be absent before `requireSession` is the authority.
- Phase 2 before Phase 3: The full conversation loop must work before polish features are layered on. VAD visualizer and history panel require a stable API contract.
- Phase 4 last: Test updates require stable API contracts; README needs final feature set known.
- Phases 3d (index.html), 4a-4f (dead file deletion, env update) can run in parallel once Phase 2 is complete — they are independent file changes.

### Research Flags

**Standard patterns (no `/gsd-research-phase` needed):**
- Phase 1 (Strip/SQLite): `bun:sqlite` and dependency removal are well-documented with verified patterns in STACK.md.
- Phase 2 (iron-session): Documented with verified `sealData`/`unsealData` code in ARCHITECTURE.md.
- Phase 4 (Cleanup/Docs): Routine; no research needed.

**Spot-check recommended before implementation:**
- Phase 3 (VAD visualizer): ElevenLabs `vad_score` client event confirmed in April 2025 changelog; verify exact `onMessage` payload property name (`vad_score` vs `vadScore`) against current `@elevenlabs/react` TypeScript types before wiring.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via npm registry and official Bun docs; iron-session v8 Bun compatibility confirmed via README and web search |
| Features | HIGH | Codebase read directly; ElevenLabs SDK verified via Context7; VAD score confirmed in April 2025 ElevenLabs changelog |
| Architecture | HIGH | Brownfield refactor with well-understood primitives; `sealData`/`unsealData` pattern verified against iron-session docs; bun:sqlite patterns from official Bun docs |
| Pitfalls | HIGH | Derived from direct codebase analysis plus verified library behaviors; not speculative |

**Overall confidence:** HIGH

### Gaps to Address

- **VAD score payload shape:** Event name confirmed (`vad_score`) but exact TypeScript property in the `onMessage` payload should be verified from `@elevenlabs/react` types before Phase 3 implementation begins.
- **System prompt override size limit:** ElevenLabs knowledge-base limit is ~300k chars; the per-conversation `overrides.agent.prompt.prompt` limit may differ. A `MAX_PROMPT_CHARS` guard (~8 000 chars) is recommended; exact limit should be confirmed if large documents are expected.
- **PDF parsing (intentionally deferred):** Restricting to `.txt`/`.md` is the correct Phase 1 action. Real PDF parsing is a v1.x item; no research conducted this milestone — intentional.
- **iron-session Web headers API variant:** ARCHITECTURE.md notes `getIronSession(req.headers, responseHeaders, opts)` as a potential alternative. The `sealData` path is the safer recommendation for Bun; confirm before committing if iron-session v8 has updated its vanilla handler docs.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/vvo/iron-session` — `sealData`/`unsealData` API, cookie options, Bun runtime compatibility
- Context7 `/oven-sh/bun` — `bun:sqlite` prepared statements, WAL mode, `globalThis` singleton for hot reload, `PRAGMA user_version`
- npm registry `iron-session@8.0.4` — confirmed latest version and dependency chain (`iron-webcrypto`, `uncrypto`, `cookie`)
- ElevenLabs official docs (live fetch) — `/v1/user` validation endpoint, conversation overrides, VAD score client event (April 2025 changelog)
- Direct codebase read — `src/index.ts`, `src/api/agents.ts`, `src/api/knowledgebase.ts`, `src/components/ConversationView.tsx`, `src/lib/authFetch.ts`, `src/App.tsx`, `src/api/agentPrompts.ts`

### Secondary (MEDIUM confidence)
- WebSearch "iron-session Bun 2025" — confirmed v8 Bun runtime support claim
- oneuptime Bun SQLite guide (Jan 2026) — migration pattern with `schema_migrations` table
- bun-sqlite-migrations (github.com/patlux) — `PRAGMA user_version` pattern reference
- ElevenLabs knowledge base limits (web search) — 300k char limit confirmed for non-enterprise

---
*Research completed: 2026-04-22*
*Ready for roadmap: yes*
