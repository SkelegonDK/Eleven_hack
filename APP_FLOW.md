# PODU Application Flow

## Overview

```mermaid
graph TD
  Start["User runs bun dev"] --> Serve["Bun server starts<br/>127.0.0.1:3000"]
  Serve --> Browser["User opens localhost:3000"]
  Browser --> Landing["LandingPage renders<br/>subject + mode selectors"]

  Landing --> Pick["User picks 1-3 subjects<br/>+ a conversation mode"]
  Pick --> Play["User clicks Play"]
  Play --> GetAgent["POST /api/agents<br/>{ mode, subjects }"]

  GetAgent --> ResolveAgent["Server resolves mode to<br/>ELEVENLABS_AGENT_ID_*<br/>env var"]
  ResolveAgent --> BuildPrompt["Server builds system prompt<br/>(mode prompt + topic lock +<br/>uploaded documents)"]
  BuildPrompt --> ReturnAgent["Return { agentId,<br/>systemPrompt, firstMessage }"]

  ReturnAgent --> ConvView["ConversationView mounts"]
  ConvView --> GetToken["GET /api/agents/:agentId/<br/>conversation-token"]
  GetToken --> ElevenToken["Server calls ElevenLabs<br/>with ELEVENLABS_API_KEY<br/>to mint token"]
  ElevenToken --> Start3["conversation.startSession<br/>(WebRTC, prompt override)"]
  Start3 --> Talk["Real-time voice<br/>conversation with agent"]
```

## Server Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents` | POST | Resolve a mode + subjects to an `agentId` + system prompt |
| `/api/agents/:agentId/conversation-token` | GET | Mint a short-lived WebRTC token from ElevenLabs |
| `/api/documents` | GET, POST | List / upload knowledge-base documents (in-memory) |
| `/api/documents/:id` | GET, DELETE | Read / delete a document |
| `/api/health` | GET | Health check |
| `/frontend.tsx` | GET | Bun-transpiled React entry point |
| `/*` | GET | Static assets or fallback HTML |

## Environment Variables

Set in `.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | Server-side ElevenLabs API key (used to mint conversation tokens) |
| `ELEVENLABS_AGENT_ID_FUN` | Agent ID for "fun" mode |
| `ELEVENLABS_AGENT_ID_EDU` | Agent ID for "educational" mode |
| `ELEVENLABS_AGENT_ID_DEEP` | Agent ID for "deep" mode |
| `HOST` (optional) | Bind host, default `127.0.0.1` |
| `PORT` (optional) | Bind port, default `3000` |

The API key stays on the server. The browser receives only short-lived conversation tokens.
