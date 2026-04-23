# Feature Research

**Domain:** ElevenLabs-powered interactive AI podcast demo (portfolio piece)
**Researched:** 2026-04-22
**Confidence:** HIGH — codebase read directly; ElevenLabs SDK and API verified via Context7/official docs

---

## Feature Landscape

### Table Stakes (Users Expect These)

These features make the "clone → run → talk" story work end-to-end. Any gap here breaks the portfolio pitch before the conversation quality can speak for itself.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ElevenLabs API key entry dialog (first-run) | The entire setup story is "enter your key and go." Without this gate the app crashes on first load or throws an opaque error | LOW | In-app Radix Dialog; POST key to `/api/key`; server validates against ElevenLabs before storing in iron-session cookie |
| API key re-entry when invalid / expired | Users will paste a wrong key or rotate it; a silent failure with no recovery path is worse than an error banner | LOW | Same dialog, pre-filled with error message; triggered by any ElevenLabs 401 response |
| API key stored in encrypted iron-session cookie, never client-visible | Recruiters trust the demo with their actual key; leaking it to the browser would be a disqualifying code smell | LOW | Already in repo (`iron-session`); just wire the key-entry flow through it |
| Topic selection (1–3 topics from preset list) | Core interaction loop; already shipped and working | LOW | `SubjectSelector` + 7 preset subjects + upload — keep as-is |
| Mode selection (FUN / EDU / DEEP) | Core differentiator; already shipped and working | LOW | `ModeSelector` — keep as-is; prompts in `agentPrompts.ts` are already high-quality |
| One-tap WebRTC conversation start | The demo's entire value is hearing the AI within seconds of setup | LOW | `ConversationView` + `useConversation` hook already wired; keep |
| Mute / unmute host audio | Users expect basic playback control during a live session | LOW | Already implemented in `ConversationView` via `setVolume` |
| Mic permission prompt with clear error state | WebRTC requires mic access; a cryptic browser error collapses the demo | LOW | `getUserMedia` already called in `startConversation`; add explicit UI messaging on denial |
| Conversation history list (SQLite-backed) | After the first conversation, users expect to see that it was recorded; a blank slate on every reload signals an unfinished app | MEDIUM | Port from Convex to `bun:sqlite`; store `mode`, `topics[]`, `timestamp`, `duration_seconds` |
| Knowledge-base document upload (SQLite-backed) | Currently uses in-memory storage that resets on server restart — documents vanish; for a demo this is a bug, not a feature | MEDIUM | Port `knowledgebase.ts` in-memory Map to SQLite `documents` table; content stored as TEXT, injected into system prompt at conversation start |
| Document inject-into-prompt pipeline | Without this, uploaded documents do nothing useful for the conversation | LOW | Already implemented in `buildFullPrompt` via `getDocumentsContext()`; just swap the storage backend |
| Clear status indicators during call (connecting / listening / speaking) | Voice AI UX without visual feedback feels broken | LOW | Already implemented; pulsing dot + text label in `ConversationView` |
| Error messaging for failed conversation start | A silent failure when ElevenLabs token fetch fails destroys the demo experience | LOW | Already in `ConversationView`; ensure SQLite and key-validation errors propagate the same way |

---

### Differentiators (Competitive Advantage)

These are what make a recruiter remember the demo. They layer on top of a working foundation and serve the "quality of conversation" hook without requiring additional services or secrets.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Three highly-distinct host personalities with genuine anti-sycophancy rules | Most AI demos feel generic. Harry More (FUN), the Socratic educator (EDU), and the contemplative philosopher (DEEP) are recognizably different within 10 seconds. The anti-sycophancy rules are visible craft and signal strong prompt engineering awareness | LOW (already built) | `agentPrompts.ts` is already exceptional — the differentiator is preserving and showcasing it, not rebuilding it |
| VAD-score-driven audio visualizer | ElevenLabs exposes a `vad_score` client event (confirmed in ElevenLabs changelog April 2025). Using it to drive bar heights makes the visualizer react to actual speech energy rather than random `Math.random()`. Recruiters who notice this recognize it is not faked | MEDIUM | Replace the `Math.random()` in `ConversationView`'s animated bars with `vad_score` from the `onMessage` handler; requires subscribing to client events |
| Topic-pinning to bias host attention | A small interaction detail (pin one topic as the "main thread") that shows UX thinking. Structurally already in `SubjectSelector` but disconnected from prompt — currently only shows a helper text, does not affect the system prompt | LOW | Wire `pinnedSubject` through to `buildFullPrompt`; append "Give particular focus to [pinned topic]" to the `TOPIC FOCUS` block |
| Subject-responsive Aurora background | When topics are selected, the background color-shifts to reflect the chosen subjects. Already implemented with `getAuroraColors`. This is a memorable visual touch that rewards exploration — keep and highlight it | LOW (already built) | Already in `LandingPage`; zero extra work, just don't break it in the refactor |
| Mode-color-reactive LightRays | The light-ray animation color-shifts as the user switches host mode, giving each personality a visual identity before the call starts | LOW (already built) | Already in `LandingPage` via `getModeColor`; preserve through refactor |
| Reduced-motion accessibility | `prefers-reduced-motion` is already respected via `usePrefersReducedMotion`. This is signal to a recruiter that the code was written with care | LOW (already built) | Keep; do not break during the LightRays/Aurora wiring |
| Conversation history with mode badge and topic list | Recruiters can see the arc of their exploration session — which hosts they talked to, which topics. Even a simple list communicates that the app is stateful and thoughtful | MEDIUM | Part of the SQLite history feature; just expose it in a `HistoryPanel` component on the landing page |
| PDF parsing for uploaded documents | Currently `parseDocumentContent` returns a placeholder for PDFs. Real PDF → text extraction makes the knowledge-base feature actually usable with realistic input (e.g., uploading a job spec to make the host discuss it) | MEDIUM | Add `pdf-parse` or use the ElevenLabs knowledge base API's native document ingestion for text extraction; keep server-side |

---

### Anti-Features (Deliberately Out of Scope)

These are features the codebase currently has (or previously had) that must remain removed or deferred. They either break the setup story, misrepresent the product's purpose, or add friction without serving the "quality of conversation" hook.

| Feature | Why Requested / Tempting | Why It Is an Anti-Feature Here | What to Do Instead |
|---------|--------------------------|-------------------------------|--------------------|
| Clerk authentication (login / accounts) | Multi-user SaaS pattern; was in the hackathon build | Requires Clerk project setup, two extra env vars, and a login flow. Breaks the "clone → run in 5 min" promise. Recruiters are single-browser users who don't need accounts | Strip entirely; replaced by iron-session API key cookie |
| Convex database | Scalable BaaS; was in the hackathon build | Requires a Convex deployment, `npx convex dev`, and additional env vars. Adds setup surface with zero benefit for a local demo | Replace with `bun:sqlite` — zero-config, zero extra service |
| UsageMeter / plan limits / billing webhooks | SaaS revenue logic; was in the hackathon build | Irrelevant for a portfolio piece; `UsageMeter` component will render empty or broken post-auth strip | Remove `UsageMeter`, `usage.ts`, `billing.ts`, and all webhook handlers |
| Live transcription during the call | Visually impressive; commonly expected in voice AI demos | ElevenLabs WebRTC does not expose a real-time transcript stream in the React SDK at this level — the `onMessage` callback fires for internal events, not word-level ASR. Building it would require a separate Whisper/Deepgram integration, a new secret, and significant complexity. A fake live transcript is worse than no transcript | Defer. Add a note in the README that transcript is a future feature |
| Post-call summary generation | Nice portfolio feature; Vercel AI SDK is already in the repo | Requires an LLM API call after each session (either Anthropic key or a different ElevenLabs endpoint), adding another env var and breaking the "only needs ElevenLabs key" constraint | Defer to a future milestone. The Vercel AI SDK (`ai` package) is already present if it is ever added |
| URL-param or localStorage API key storage | Simpler than iron-session; lower implementation cost | Key in URL is leaked to browser history and server logs. Key in localStorage is unencrypted and browser-readable. Both are security anti-patterns visible to any recruiter who inspects the code | Keep iron-session cookie — it is already in the repo and is the correct pattern |
| Agent configuration UI | Power-user feature; ElevenLabs agents are highly configurable | Adds significant surface area (voice selection, temperature, TTS settings) that is orthogonal to the demo's pitch. ElevenLabs dashboard already handles this | Keep agents configured via ElevenLabs dashboard + env vars |
| Production deployment (Vercel / Docker) | Makes the demo publicly accessible | Not needed this milestone; adds CI/CD, secret management, and hosting concerns that distract from the core feature work. Local `bun dev` is the canonical target | Defer; no `vercel.json` changes required this milestone |
| Multi-document knowledge base persistence across sessions (server restart) | Natural expectation of any upload feature | Requires proper file storage (disk or S3), not just SQLite TEXT. Scoping to text content stored in SQLite is sufficient and matches the single-user local demo pattern | SQLite TEXT storage is the right call for this milestone; add file-on-disk storage in a future milestone if needed |
| Pinning UI exposed as a "session memory" feature | Users might interpret the pin as persistent context across sessions | Adds expectation of cross-session state that does not exist. Pin should clearly scope to the current session only | Keep pin as a single-session UX affordance; do not persist it to SQLite |

---

## Feature Dependencies

```
[Iron-session API key cookie]
    └──required by──> [ElevenLabs conversation token fetch]
                          └──required by──> [WebRTC conversation start]

[API key entry dialog]
    └──feeds──> [Iron-session API key cookie]

[SQLite database (bun:sqlite)]
    └──required by──> [Conversation history list]
    └──required by──> [Knowledge-base document storage]

[Knowledge-base document storage]
    └──feeds──> [Document → system prompt injection]
                    └──feeds──> [WebRTC conversation start with context]

[Topic selection]
    └──feeds──> [System prompt topic block]
                    └──feeds──> [WebRTC conversation start]

[Topic pinning]
    └──enhances──> [System prompt topic block]

[VAD score client event]
    └──enhances──> [Audio visualizer bars]

[Mode selection]
    └──feeds──> [Agent ID resolution]
    └──feeds──> [System prompt selection]
    └──feeds──> [LightRays color]
    └──feeds──> [Aurora colors (indirect via subject selection)]
```

### Dependency Notes

- **Iron-session cookie required before conversation start:** The server-side `/api/agents/:id/conversation-token` route uses the API key from the session. If the key is not yet set, all token fetches fail. The key-entry dialog must run as a guard on first load before any other API call is attempted.
- **SQLite must initialize before history or document routes:** The DB schema (CREATE TABLE IF NOT EXISTS) must run at server startup before any route handler that reads or writes rows. A single init function called in `src/index.ts` is sufficient.
- **Document storage must persist across server restarts before injection is useful:** The current in-memory Map is wiped on restart. SQLite persistence is what upgrades "upload" from a broken feature to a working one.
- **Topic pinning enhances but does not block system prompt:** Pinning is additive — the prompt works correctly without a pinned topic.
- **VAD score enhances but does not block visualizer:** The current random-height bars are functional fallback behavior.

---

## MVP Definition

### Launch With (v1 — this milestone)

- [x] API key entry dialog (first-run + re-entry on 401) — the setup story lives or dies here
- [x] Encrypted iron-session cookie for API key — already in repo; just wire it
- [x] Remove Clerk, Convex, UsageMeter, billing/usage routes — clearing the hackathon SaaS scaffolding
- [x] SQLite-backed conversation history (mode, topics, timestamp, duration) — proves the app is stateful
- [x] SQLite-backed knowledge-base document storage (text content; replaces in-memory Map) — makes upload actually work
- [x] Topic pinning wired into system prompt — low-effort, high-signal of craft
- [x] Existing visual polish preserved (Aurora, LightRays, mode-color theming, reduced-motion) — already impressive; just don't break it

### Add After Validation (v1.x)

- [ ] VAD-score-driven audio visualizer — replaces `Math.random()` bars; noticeable quality improvement; low risk to core flow
- [ ] Real PDF parsing (server-side text extraction) — makes knowledge-base upload genuinely useful with real documents; blocked on choosing a PDF library compatible with Bun

### Future Consideration (v2+)

- [ ] Post-call summary generation — requires LLM API call; breaks single-key constraint; defer until milestone defines a second secret is acceptable
- [ ] Live transcription — requires separate ASR integration; significant scope; defer
- [ ] Production deployment (Vercel / Railway) — add after the demo is portfolio-ready locally

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| API key entry dialog | HIGH | LOW | P1 |
| Iron-session key storage | HIGH | LOW | P1 |
| Remove Clerk / Convex / billing | HIGH (removes setup friction) | MEDIUM | P1 |
| SQLite conversation history | HIGH | MEDIUM | P1 |
| SQLite knowledge-base document storage | HIGH | MEDIUM | P1 |
| Topic pinning → system prompt | MEDIUM | LOW | P1 |
| Visual polish preservation (Aurora, LightRays) | MEDIUM | LOW (do-not-break) | P1 |
| VAD-score audio visualizer | MEDIUM | MEDIUM | P2 |
| Real PDF parsing | MEDIUM | MEDIUM | P2 |
| Conversation history UI panel | MEDIUM | LOW | P2 |
| Post-call summary | LOW (breaks key constraint) | HIGH | P3 |
| Live transcription | LOW (breaks key constraint) | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have; add when core is stable
- P3: Defer to future milestone

---

## Competitor Feature Analysis

Framing: the relevant comparison is not other podcast apps but other voice AI demos a recruiter might have seen.

| Feature | Typical voice AI demo | ElevenLabs widget embed | PODU approach |
|---------|----------------------|------------------------|---------------|
| Host personality | Single generic assistant | Generic (voice only) | Three fully-characterized hosts with anti-sycophancy rules — highest craft signal |
| Setup friction | Often requires cloud account + hosted URL | Paste agent ID into webpage | Clone repo + one ElevenLabs key — lowest friction for a local demo |
| Context injection | Rarely supported | ElevenLabs dashboard knowledge base only | Upload doc → injected into system prompt at conversation start; recruiter can demo with their own content |
| Visual feedback | Basic or none | None | Aurora + LightRays + mode-reactive color + animated status dots — memorable without being distracting |
| Conversation history | None | None | SQLite-backed list; shows the app is a product, not a spike |
| Accessibility | Rarely considered | N/A | `prefers-reduced-motion` respected; signals careful engineering |

---

## Sources

- Direct codebase read: `src/api/agentPrompts.ts`, `src/api/agents.ts`, `src/api/knowledgebase.ts`, `src/components/ConversationView.tsx`, `src/components/LandingPage.tsx`, `src/components/SubjectSelector.tsx`, `src/components/ModeSelector.tsx`, `src/components/DocumentUpload.tsx`, `src/components/UploadDialog.tsx`
- `.planning/PROJECT.md` — milestone scope, out-of-scope list, constraints
- ElevenLabs official docs via Context7 (`/elevenlabs/elevenlabs-docs`) — confirmed: conversation overrides (system prompt, firstMessage), VAD score client event (confirmed in April 2025 changelog), conversation list endpoint filtering
- ElevenLabs React SDK via Context7 (`/websites/npmjs_package_elevenlabs_react`) — confirmed: `useConversation` hook, `status`, `isSpeaking`, `setVolume` API
- ElevenLabs April 2025 changelog (Context7 source): `vad_score` client event documented and available

---

*Feature research for: PODU portfolio demo — ElevenLabs interactive AI podcast*
*Researched: 2026-04-22*
