# Pitfalls Research

**Domain:** Portfolio-demo refactor — SaaS-to-single-key Bun + iron-session + bun:sqlite + ElevenLabs WebRTC
**Researched:** 2026-04-22
**Confidence:** HIGH (code verified from actual files; library behavior confirmed via Context7 and official docs)

---

## Critical Pitfalls

### Pitfall 1: WebRTC system-prompt override silently discarded when field is empty string

**What goes wrong:**
`ConversationView.startSession()` passes `overrides.agent.prompt.prompt = systemPrompt` and `overrides.agent.firstMessage`. The ElevenLabs React SDK docs warn: "omit any fields you don't want to override rather than setting them to empty strings or null values." If `systemPrompt` is ever an empty string (e.g., knowledgebase returns nothing and topic section is skipped), the override field is still sent and the agent silently falls back to its dashboard-configured prompt — which might be the old Clerk-era prompt. The conversation starts but topics are ignored.

**Why it happens:**
After the Convex strip-out, `getDocumentsContext()` starts from an in-memory Map that is always empty on a fresh run (documents not yet ported to SQLite). `buildFullPrompt()` concatenates an empty string. No error is thrown; the API call succeeds. The bug is invisible until a recruiter notices the agent ignores the chosen topics.

**How to avoid:**
- Assert `systemPrompt.length > 0` in `getAgentForMode()` before returning; throw an error rather than returning a falsy prompt.
- In the SDK call, only include `prompt` in the overrides object if its value is a non-empty string (`prompt && { prompt: { prompt } }`).
- Add a unit test for `buildFullPrompt` covering the zero-documents case.

**Warning signs:**
- `buildFullPrompt()` returns only whitespace.
- Agent mentions topics not chosen by the user during a Playwright smoke test.
- Console shows no error but the first message doesn't match the selected mode.

**Phase to address:** Phase 1 (strip Convex, port knowledgebase to SQLite) — write the `buildFullPrompt` guard before touching the document layer.

---

### Pitfall 2: ElevenLabs API key sent to the browser or logged to stdout

**What goes wrong:**
`getConversationToken()` in `agents.ts` reads `process.env.ELEVENLABS_API_KEY` and sends it as an `xi-api-key` header in a server-side fetch. If the key is accidentally injected into the Bun.build `define` block (like `VITE_PUBLIC_CLERK_PUBLISHABLE_KEY` is today at `src/index.ts` line 392), it lands in the compiled JS bundle served to every browser visitor. Similarly, if a developer adds a debug `console.log(req)` or error-logs the full request body that contains a session containing the key, the key appears in stdout.

**Why it happens:**
The existing `Bun.build define` block already injects env vars into the frontend bundle. It is natural to add `ELEVENLABS_API_KEY` there when setting up the key-entry dialog — wrong. The iron-session cookie stores the user-provided key server-side, but a careless `console.log(session)` will print the encrypted payload (still shows the raw key after decryption in dev).

**How to avoid:**
- Never add `ELEVENLABS_API_KEY` to the Bun.build `define` block. Audit the define object before every commit.
- The user-provided key is stored in the iron-session cookie. The session object must never be logged. Add an eslint rule or comment warning at the session read site.
- The API-key-entry dialog must POST to a server endpoint (`/api/session/set-key`); the key must never pass through a client-readable response or state.
- Add a `grep -r "ELEVENLABS_API_KEY" src/frontend.tsx src/components/` check to CI.

**Warning signs:**
- Network tab in browser DevTools shows an `xi-api-key` request header originating from the browser.
- `window.__ELEVENLABS_API_KEY__` exists in the browser console.
- The key appears in plain text in the compiled `/frontend.tsx` response.

**Phase to address:** Phase 2 (iron-session + API key dialog) — establish the server-only boundary before the dialog ships; enforce via grep in the Playwright test setup.

---

### Pitfall 3: iron-session secret is too short, not randomised, or committed to the repo

**What goes wrong:**
iron-session requires `password` to be at least 32 characters. If the developer sets `IRON_SESSION_SECRET_KEY=secret` or copies a placeholder from a comment, the session cookie is effectively unencrypted (the library will throw at runtime, crashing the server). If the secret is committed to `.env` instead of `.env.local`, it lands in git history and every cloner can decrypt stored API keys from their own cookie.

**Why it happens:**
`.env.example` files routinely contain placeholder secrets. Developers copy them verbatim when setting up quickly. There is no existing enforcement in the codebase.

**How to avoid:**
- At server startup, validate `IRON_SESSION_SECRET_KEY.length >= 32`; throw a loud, clear error before starting the HTTP listener.
- `.env.example` must show a placeholder that is obviously fake AND include a generation command: `# Generate: openssl rand -hex 32`.
- `.gitignore` must include `.env` and `.env.local`; add a pre-commit hook comment in README.
- The iron-session options should always include `cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" }` — never omit these.

**Warning signs:**
- `IRON_SESSION_SECRET_KEY` is fewer than 32 characters → iron-session throws `"Password must be at least 32 characters long"` at the first session read.
- Server starts but session reads always return `{}` (misconfigured secret rotates the seal, producing an always-invalid cookie).
- `.env` appears in `git status` as a tracked file.

**Phase to address:** Phase 2 (iron-session setup) — enforce the length check in the startup guard before any route is registered.

---

### Pitfall 4: bun:sqlite Database opened multiple times during `bun --hot` reloads, leaking file handles

**What goes wrong:**
`bun dev` runs with `--hot` (see `package.json` scripts). During hot reload, module-level `let db = new Database(...)` executes again, opening a second connection to the same SQLite file. The old connection is not explicitly closed. Over many hot reloads the WAL checkpoint accumulates, file descriptors leak, and in the worst case concurrent writes from two open connections produce `SQLITE_BUSY` errors or database corruption.

**Why it happens:**
Developers naturally write `const db = new Database("podu.db")` at the top of a db module. Hot reload re-executes module top-level code but the old module instance (and its open connection) remains in memory until GC.

**How to avoid:**
- Store the database instance on `globalThis`: `globalThis.__db ??= new Database("podu.db")`. Hot reload will not re-open the file if the instance already exists on globalThis.
- Add `import.meta.hot?.dispose(() => { globalThis.__db?.close(); delete globalThis.__db; })` so a clean full restart closes the connection properly.
- Enable WAL mode immediately after opening: `db.run("PRAGMA journal_mode = WAL;")` — required for any concurrent-read scenario.
- Enable foreign keys: `db.run("PRAGMA foreign_keys = ON;")`.

**Warning signs:**
- `SQLITE_BUSY` errors in the console after saving a source file during `bun dev`.
- `lsof | grep podu.db` shows multiple open handles to the same file.
- Database file size grows unexpectedly large without proportional data.

**Phase to address:** Phase 3 (SQLite schema + data layer) — the globalThis singleton pattern must be part of the initial db.ts module, not retrofitted.

---

### Pitfall 5: Clerk/Convex removal leaves dead imports that break TypeScript compilation

**What goes wrong:**
After removing Clerk and Convex, orphaned imports remain in files that were not directly touched: `src/components/ConversationView.tsx` imports `useAuth` from `@clerk/clerk-react`; `src/lib/authFetch.ts` wraps `getToken` from Clerk; `src/App.tsx` wraps `ConvexProviderWithClerk`; `src/frontend.tsx` defines the Clerk/Convex providers. If these are left in place, TypeScript strict mode fails the build when the packages are removed from `package.json`. Worse: if the packages are NOT removed (to avoid the TS error), they add ~200 KB to the bundle and Clerk tries to load its CDN script, producing console errors on every page load.

**Why it happens:**
Removal is done route-by-route in `src/index.ts` but the component tree imports are not audited. TypeScript catches the missing-package errors, but only if `bun build` is run, not during `bun dev` which transpiles on demand.

**How to avoid:**
- Run `bunx knip` after every removal phase to find unused exports and dead imports.
- Remove `@clerk/backend`, `@clerk/clerk-react`, `convex`, `svix` from `package.json` as the first act of Phase 1, before touching any route logic. TypeScript will then surface every orphaned import immediately.
- The `authFetch.ts` helper must be replaced with a plain `fetch` wrapper that reads no Clerk token; until replaced, it is a compile error.
- `src/components/ConversationView.tsx` must have `useAuth` / `getToken` replaced with a no-op or removed entirely; the usage reporting endpoint becomes a public route (session cookie provides identity).

**Warning signs:**
- `Cannot find module '@clerk/clerk-react'` or `@clerk/backend` at startup after package removal.
- `bun build` succeeds but browser console shows `Clerk.js` 404 errors.
- `ConvexProviderWithClerk` referenced in `src/frontend.tsx` but package is gone.

**Phase to address:** Phase 1 (dependency strip) — remove packages first, fix compiler errors second; this forces complete cleanup before any other work.

---

### Pitfall 6: API key validation skips the ElevenLabs user endpoint, letting garbage keys proceed to WebRTC

**What goes wrong:**
Without validation, a recruiter who miscopies their key (e.g., adds a space, pastes from a wrong tab) will successfully submit the setup dialog, reach the topic selection screen, click Play, and then get a cryptic WebRTC error like `"Failed to get conversation token: 401"` — at which point the demo looks broken, not the key. The portfolio hook fails at the most visible moment.

**How to avoid:**
- On `POST /api/session/set-key`, immediately call `GET https://api.elevenlabs.io/v1/user` with the submitted key. A 200 response confirms the key is valid; any non-200 returns a `400 { error: "Invalid API key" }` before storing anything in the session.
- The `/v1/user` endpoint is the documented validation path (confirmed via official ElevenLabs docs). It is free to call and returns subscription info that can be surfaced in the UI ("logged in as user@example.com").
- Show a clear, friendly error in the dialog: "That key doesn't seem to work. Double-check it in the ElevenLabs dashboard."

**Warning signs:**
- Session is set without a prior validation call to ElevenLabs.
- `getConversationToken()` returns 401 after a successful setup dialog submission.
- The key-entry dialog has no loading or error state.

**Phase to address:** Phase 2 (iron-session + API key dialog) — validation must be part of the key-submission handler, not deferred.

---

### Pitfall 7: Knowledge-base documents lost on server restart (in-memory Map not ported to SQLite)

**What goes wrong:**
`src/api/knowledgebase.ts` stores documents in a module-level `Map<string, Document>`. After the refactor, documents uploaded before a server restart vanish silently. The user re-uploads, server restarts again during `bun dev` hot reload, documents are gone again. A recruiter who uploads a PDF as context for the conversation will find the agent has no knowledge of it.

**Why it happens:**
The existing code has a TODO comment acknowledging this. The Convex port was never completed in the hackathon build. It is easy to port the routes but forget to port the persistence layer.

**How to avoid:**
- Port `knowledgebase.ts` to SQLite atomically with the Convex removal in Phase 1. Do not ship a version that removes Convex without adding SQLite persistence.
- SQLite schema: `CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT NOT NULL, content TEXT NOT NULL, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP)`.
- Use prepared statements (`db.query(...)`) for all document operations — never string-interpolate user input into SQL.
- Add a test that restarts the server process and verifies a previously uploaded document is still listed.

**Warning signs:**
- `listDocuments()` returns `[]` after a server restart even though documents were uploaded.
- The `documents` Map is imported from a module that does not reference `bun:sqlite`.
- Knowledgebase routes return 200 but document content never appears in the system prompt.

**Phase to address:** Phase 1 (Convex removal) — in-memory knowledgebase must be replaced before Convex is removed, not after.

---

### Pitfall 8: PDF upload silently produces a placeholder string in the system prompt

**What goes wrong:**
`parseDocumentContent()` in `knowledgebase.ts` lines 82–91 returns `"[PDF content from X - PDF parsing not yet implemented]"` for PDF uploads. This string gets concatenated into the system prompt and sent to ElevenLabs. The agent will read it aloud or reference it verbatim if asked about the document. A recruiter who uploads their resume as context will hear the agent say "I see you've uploaded a PDF but I can't read it."

**How to avoid:**
- Add a file-type restriction in the upload UI: only accept `.txt` and `.md` until PDF parsing is implemented. Use `accept=".txt,.md"` on the file input.
- If PDF support is desired, add `pdf-parse` (npm) and call it synchronously in the server handler. Validate content length before storing.
- Return a 400 error for unsupported types with a message: "Only .txt and .md files are supported in this demo."
- Never store placeholder text in the document content field.

**Warning signs:**
- `parseDocumentContent()` returns a string containing `"not yet implemented"`.
- The upload dialog accepts `.pdf` without error.
- System prompt contains literal bracketed placeholder text.

**Phase to address:** Phase 1 (document layer) — restrict accepted types on day one; defer real PDF parsing to a future milestone.

---

### Pitfall 9: Cookie `secure: true` breaks local HTTP development (all session reads return empty)

**What goes wrong:**
iron-session's default `cookieOptions.secure` is `true`. When running `bun dev` over plain HTTP at `localhost:3000`, browsers refuse to send a `Secure` cookie on non-HTTPS connections. Every request to `/api/agents` reads an empty session, finds no API key, and returns 401. The developer sees auth failures with no obvious error because the cookie is set successfully (the `Set-Cookie` header is emitted) but never returned by the browser on subsequent requests.

**Why it happens:**
The default iron-session options are production-safe, not development-safe. The pattern `secure: process.env.NODE_ENV === "production"` is the documented fix but is easily overlooked.

**How to avoid:**
- Set `cookieOptions: { secure: process.env.NODE_ENV === "production" }` in the iron-session options — exactly as the official docs recommend.
- Test the session flow with `bun dev` (HTTP) and verify the cookie round-trips correctly before declaring Phase 2 complete.
- `httpOnly: true` and `sameSite: "lax"` must always be set regardless of environment.

**Warning signs:**
- Session reads always return `{}` in development despite a successful key submission.
- Browser DevTools shows the `Set-Cookie` header but the cookie tab shows it as "blocked" or absent on the next request.
- `/api/session/status` returns `{ hasKey: false }` immediately after `/api/session/set-key` returns 200.

**Phase to address:** Phase 2 (iron-session setup) — the options object must be reviewed before the first session write is tested.

---

### Pitfall 10: WebRTC microphone permission denied kills the demo silently on first run

**What goes wrong:**
`ConversationView.startConversation()` calls `navigator.mediaDevices.getUserMedia({ audio: true })` before fetching the conversation token. If the recruiter's browser has previously denied microphone access to localhost (common with Chrome's persistent permission denials), `getUserMedia` throws `NotAllowedError`. The current error handler sets `startError` to the exception message, which reads as a technical error rather than actionable guidance.

**How to avoid:**
- Catch `NotAllowedError` specifically and show: "Microphone access was denied. Please allow microphone access in your browser settings and try again." with a link to browser-specific instructions.
- Prompt for microphone permission during the landing page, before the user enters the ConversationView, with a pre-flight check: `await navigator.permissions.query({ name: "microphone" })`. Warn if `state === "denied"` before the user clicks Play.
- Add this check to the Playwright smoke test: verify `getUserMedia` is mocked and the error banner shows the right message when it rejects.

**Warning signs:**
- `startError` is set to `"NotAllowedError: Permission denied"` with no user-friendly explanation.
- The Play button is disabled after the error but there is no recovery path shown.
- No pre-flight microphone check before mounting ConversationView.

**Phase to address:** Phase 4 (end-to-end Playwright validation) — but the user-friendly error text should be added in Phase 2 when ConversationView is refactored away from Clerk.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `svix` in package.json after removing Clerk webhook | Avoids touching package.json | 80 KB dead dependency; TypeScript sees Webhook import that goes nowhere | Never — remove with Clerk in Phase 1 |
| Keep usage-recording route (`/api/usage/record`) and just make it a no-op | Avoids touching ConversationView | Dead route creates confusion; ConversationView still imports authFetch | Never — remove route and strip the client call together |
| Store API key in localStorage instead of iron-session | Simpler implementation | Key visible in DevTools; violates the explicit security constraint | Never — the constraint is non-negotiable per PROJECT.md |
| Skip WAL mode on bun:sqlite | One fewer PRAGMA | Concurrent reads during knowledgebase fetch + conversation token race can produce SQLITE_BUSY | Never — one line of code, no downside for a local demo |
| Use `bun --watch` instead of `bun --hot` in dev | Simpler mental model | In-memory state lost on every file save; knowledgebase uploads vanish during development | Acceptable only if globalThis singleton pattern is used for SQLite |
| Leave SaasLandingPage.tsx and PricingPage.tsx in src/components/ | Faster Phase 1 | Dead components bloat the bundle; TypeScript may still import Clerk types through them | Only temporarily, cleaned in the same phase |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ElevenLabs WebRTC — system prompt override | Sending `prompt: ""` when no documents are uploaded | Guard: only include `prompt` key in overrides if `systemPrompt.length > 0` |
| ElevenLabs — API key validation | Skipping validation; first error surfaces at WebRTC token fetch | Call `GET /v1/user` server-side on key submission; cache the user's display name in session |
| ElevenLabs — conversation token | Token fetched once and cached; it may expire if the tab is left open | Fetch token fresh on every Play button click, not at page load |
| iron-session — Bun HTTP (no framework) | Using the Next.js/Express `getIronSession(req, res, opts)` signature; Bun's `Response` is immutable | Use `getIronSession(req.headers, responseHeaders, opts)` or the Web-standard cookies API pattern; verify against iron-session v8 README for vanilla handler usage |
| bun:sqlite — hot reload | Module-level `new Database(...)` opens a new connection on every file save | Use `globalThis.__db ??= new Database(...)` singleton |
| Clerk removal — authFetch | `authFetch` in `src/lib/authFetch.ts` calls `getToken()` which is gone | Replace with a plain `fetch` wrapper; remove `getToken` from all component signatures |
| ElevenLabs knowledgebase | Uploading PDF through the existing dialog returns a placeholder injected into the system prompt | Restrict accepted file types to `.txt`/`.md` at the input level; reject others with a 400 |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `buildFullPrompt()` concatenates all documents on every `/api/agents` call with no size cap | Slow agent start; ElevenLabs may silently truncate prompts above their limit | Add a `MAX_PROMPT_CHARS` guard (e.g., 8 000 chars); truncate oldest documents first | Any document > ~6 KB of text |
| SQLite opened without WAL mode under `bun dev` hot reload | Intermittent `SQLITE_BUSY` during concurrent history write + document fetch | `PRAGMA journal_mode = WAL` immediately after open | First time two routes hit SQLite within the same event loop tick |
| Bun.build transpiles frontend on every request in dev (no caching) | Slow page reload; > 1 s TTFB | This is the existing pattern; acceptable for dev; add a build cache for `bun start` (prod mode) | Never in dev; matters only if running `bun start` locally |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| ElevenLabs API key in Bun.build `define` block | Key ships in browser bundle; visible in DevTools source and network tab | Never add `ELEVENLABS_API_KEY` to define; keep it server-only; audit before each commit |
| Iron-session secret shorter than 32 chars | Library throws at runtime OR uses weak encryption if a fallback path exists | Startup guard: `if (secret.length < 32) throw new Error(...)` before `serve()` |
| Session object logged to stdout | Key visible in server logs / terminal history | Never log the session object; add a lint comment at every `getIronSession` call site |
| Leftover `/api/webhooks/clerk` route accepting arbitrary POST | If the route persists post-refactor without the Svix secret, any caller can POST and trigger server-side errors | Remove the route entirely in Phase 1; do not leave it as a no-op |
| Document content injected verbatim into system prompt without sanitisation | A document containing `"Ignore all previous instructions and..."` manipulates the agent | Add a `MAX_DOCUMENT_CHARS` limit (e.g., 20 000 chars); strip triple-dash separators from content to prevent prompt boundary confusion |

---

## UX Pitfalls (Recruiter Experience)

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Error message says "Failed to get conversation token: 401" on a bad API key | Recruiter thinks the app is broken, not that their key is wrong | Validate the key at setup; show "Invalid API key — check the ElevenLabs dashboard" at submission time |
| Key-entry dialog has no "test my key" feedback; just saves and redirects | Recruiter pastes wrong key; failure surfaces 30 seconds later during WebRTC | Call `/v1/user` synchronously on submit; show success ("Connected as X") or failure inline |
| Topics selected but agent ignores them due to empty system prompt | Demo's core value proposition (customised conversation) fails silently | Assert non-empty prompt server-side; surface error before starting WebRTC session |
| `bun dev` starts but console is full of Clerk 404 / missing-env warnings | Recruiter reviewing the server output sees warning noise that implies misconfiguration | Remove Clerk entirely; clean startup must show only `PODU server running at http://localhost:3000` |
| Microphone permission denied shows a raw JS error string | Recruiter doesn't know how to fix it | Catch `NotAllowedError` by name; show browser-specific recovery instructions |
| PDF upload appears to succeed but agent has no knowledge of the document | Recruiter wastes time and trust; the knowledge-base feature appears broken | Restrict upload to `.txt`/`.md`; show a clear notice that PDF parsing is not supported |
| ConversationView audio visualizer uses `Math.random()` on every render tick | Seizure-inducing flicker when `isSpeaking` changes rapidly; looks unpolished on screen-record | Replace with a CSS animation or stable sample rather than random per-render values |

---

## "Looks Done But Isn't" Checklist

- [ ] **Clerk removal:** `@clerk/backend` and `@clerk/clerk-react` are absent from `package.json` AND absent from all imports — `grep -r "clerk" src/` returns zero matches.
- [ ] **Convex removal:** `convex/` directory is deleted AND `CONVEX_URL` is absent from `.env.example` AND `ConvexProviderWithClerk` is gone from `frontend.tsx`.
- [ ] **API key boundary:** `grep -r "ELEVENLABS_API_KEY" src/frontend.tsx src/components/` returns zero matches.
- [ ] **Iron-session secret guard:** Server throws a clear error and refuses to start if `IRON_SESSION_SECRET_KEY` is missing or shorter than 32 characters.
- [ ] **Cookie security flags:** `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"` are all set in the session options.
- [ ] **SQLite WAL mode:** `PRAGMA journal_mode = WAL` is called immediately after `new Database(...)`.
- [ ] **SQLite singleton:** The database instance is stored on `globalThis`, not at bare module scope.
- [ ] **Document persistence:** A server restart followed by `GET /api/documents` returns the previously uploaded documents.
- [ ] **PDF restriction:** The upload dialog does not accept `.pdf` files (or accepts them and returns a clear 400).
- [ ] **System prompt non-empty guard:** `getAgentForMode()` throws if `buildFullPrompt()` returns fewer than 10 characters.
- [ ] **ElevenLabs key validation:** Submitting an invalid key to the setup dialog returns an error message, not a successful redirect.
- [ ] **Dead routes removed:** `/api/webhooks/clerk`, `/api/usage`, `/api/usage/record` are absent from `src/index.ts` after the refactor (or replaced by their SQLite equivalents).
- [ ] **Clean startup:** `bun dev` produces no warning lines about missing Clerk, Convex, or webhook secrets.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| API key exposed in frontend bundle | HIGH | Rotate the ElevenLabs API key immediately; audit git history for committed `.env` files; remove the define entry and redeploy |
| SQLite corruption from unclosed connections | MEDIUM | Delete `podu.db` and `podu.db-wal`; restart server (schema is recreated on startup); reimport conversation history if backed up |
| Iron-session secret changed (all existing sessions invalid) | LOW | All users must re-enter their API key; this is acceptable for a single-user local demo |
| Orphaned Clerk import breaks TypeScript compilation | LOW | `grep -r "@clerk" src/` to find all remaining imports; remove or replace each one; remove packages; rebuild |
| WebRTC fails silently due to bad system prompt | LOW | Add the prompt-length guard and redeploy; no data loss |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebRTC prompt override silently discarded | Phase 1 (prompt layer) | Unit test: `buildFullPrompt` with zero documents returns a non-empty string |
| API key exposed to browser | Phase 2 (iron-session) | `grep -r "ELEVENLABS_API_KEY" src/components src/frontend.tsx` returns zero |
| Weak iron-session secret | Phase 2 (iron-session) | Startup throws if secret < 32 chars; verified by a failing test with a short secret |
| bun:sqlite multiple connections on hot reload | Phase 3 (SQLite layer) | `lsof \| grep podu.db` shows one handle after 5 file-save cycles |
| Orphaned Clerk/Convex imports break build | Phase 1 (dependency strip) | `bun build` completes with zero errors after package removal |
| API key validation skipped | Phase 2 (key dialog) | Playwright: submit wrong key → error banner appears; no redirect |
| Document persistence lost on restart | Phase 1 (knowledgebase port) | Playwright: upload doc → restart server → doc still listed |
| PDF placeholder in system prompt | Phase 1 (upload restriction) | Upload `.pdf` → server returns 400 |
| Cookie `secure: true` in dev | Phase 2 (iron-session) | Session round-trips correctly over HTTP localhost |
| Microphone permission UX | Phase 2 (ConversationView refactor) | Playwright: mock denied mic → user-friendly error shown |

---

## Sources

- iron-session v8 README — https://github.com/vvo/iron-session (Context7: /vvo/iron-session) — HIGH confidence
- bun:sqlite official docs — https://bun.sh/docs/api/sqlite (Context7: /oven-sh/bun) — HIGH confidence
- ElevenLabs conversational AI overrides docs — https://elevenlabs.io/docs/agents-platform/customization/personalization/overrides — MEDIUM confidence (fetched live)
- ElevenLabs `/v1/user` endpoint — https://elevenlabs.io/docs/api-reference/user/get — HIGH confidence (fetched live, confirms 200 = valid key)
- ElevenLabs knowledge base limits — https://elevenlabs.io/docs/agents-platform/customization/knowledge-base — MEDIUM confidence (300k char limit for non-enterprise confirmed via web search)
- Bun hot reload and globalThis singleton pattern — https://bun.sh/docs/bundler/hot-reloading — HIGH confidence (confirmed via web search)
- Codebase analysis — `src/index.ts`, `src/api/agents.ts`, `src/api/knowledgebase.ts`, `src/components/ConversationView.tsx`, `src/lib/authFetch.ts` — HIGH confidence (direct file read)

---

*Pitfalls research for: PODU portfolio-demo refactor (bun:sqlite + iron-session + ElevenLabs WebRTC)*
*Researched: 2026-04-22*
