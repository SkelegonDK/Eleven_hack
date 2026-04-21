# PODU — Interactive AI Podcast

> Built for the first [ElevenLabs Hackathon](https://elevenlabs.io) in Copenhagen, hosted by [AI Tinkerers](https://copenhagen.aitinkerers.org).

PODU (Podcast Dialogue Universe) is a web app that lets you have real-time voice conversations with AI podcast hosts. Pick your topics, choose a conversation style, and start talking.

Three conversation modes with distinct personalities:

- **Fun** — Dry wit and skeptical humor (think British panel show energy)
- **Educational** — Clear explanations that build genuine understanding
- **Deep** — Philosophical exploration that challenges assumptions

Built with Bun, React 19, ElevenLabs conversational AI, Clerk auth, and Convex as the backend database.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Frontend | React 19, TypeScript, Tailwind CSS 4, Shadcn/UI |
| Voice AI | [ElevenLabs](https://elevenlabs.io) Conversational AI (WebRTC) |
| Auth | [Clerk](https://clerk.com) |
| Database | [Convex](https://convex.dev) |
| Deployment | [Vercel](https://vercel.com) (or any platform that supports Bun) |

## Prerequisites

- [Bun](https://bun.sh) v1.1+ installed
- An [ElevenLabs](https://elevenlabs.io) account with API access
- A [Clerk](https://clerk.com) application
- A [Convex](https://convex.dev) project

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/ManuelThomsen/podu.git
cd podu
bun install
```

### 2. Set up ElevenLabs agents

Create three conversational AI agents in the [ElevenLabs dashboard](https://elevenlabs.io/app/conversational-ai). Each agent corresponds to a conversation mode (fun, educational, deep). Copy the system prompts from `src/api/agentPrompts.ts` into each agent's configuration, then note down the agent IDs.

### 3. Set up Clerk

Create a Clerk application at [clerk.com](https://clerk.com). From the API Keys page, copy your publishable key and secret key.

### 4. Set up Convex

```bash
npx convex dev
```

This will prompt you to create a Convex project and link it. It will also deploy the schema and functions defined in the `convex/` directory. Note the deployment URL it gives you.

### 5. Configure environment variables

```bash
cp .env.example .env
```

Fill in your credentials:

```env
# ElevenLabs
ELEVENLABS_API_KEY=sk_...
IRON_SESSION_SECRET_KEY=<generate a random base64 string>
ELEVENLABS_AGENT_ID_FUN=agent_...
ELEVENLABS_AGENT_ID_EDU=agent_...
ELEVENLABS_AGENT_ID_DEEP=agent_...

# Clerk
VITE_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_URL=https://your-instance.clerk.accounts.dev

# Convex
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=dev:your-deployment-name
CONVEX_DEPLOYMENT_KEY=dev:your-deployment-name|...
```

You can generate an Iron Session secret with:

```bash
openssl rand -base64 32
```

### 6. Run the dev server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Clerk, pick your topics and mode, and start a conversation.

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server with hot reload |
| `bun start` | Start production server |
| `bun run build` | Build for production (outputs to `dist/`) |
| `bun test` | Run unit tests |
| `bun run test:e2e` | Run Playwright end-to-end tests |
| `bun run audit:agents` | Validate ElevenLabs agent configuration |

## Project Structure

```
src/
  index.ts              # Bun HTTP server (API routes + static serving)
  frontend.tsx           # React entry point (client-side)
  App.tsx                # Root component (auth routing)
  api/
    agents.ts            # Agent resolution and conversation tokens
    usage.ts             # Usage tracking and plan limits
    billing.ts           # Subscription plan sync
    knowledgebase.ts     # Document upload for context injection
    agentPrompts.ts      # System prompts for each conversation mode
  components/
    LandingPage.tsx      # Main app view (topic + mode selection)
    ConversationView.tsx # Active conversation UI with waveform
    SubjectSelector.tsx  # Topic picker (1-3 topics)
    ModeSelector.tsx     # Conversation mode picker
    SaasLandingPage.tsx  # Marketing page for signed-out users
    UsageMeter.tsx       # Usage display
    DocumentUpload.tsx   # Knowledge base upload
    ui/                  # Shadcn/UI components
  lib/
    authFetch.ts         # Fetch wrapper with Clerk auth tokens
convex/
  schema.ts              # Data model (users, conversations)
  users.ts               # User management mutations/queries
  conversations.ts       # Conversation tracking
```

## How It Works

1. The Bun server transpiles the React frontend at request time, injecting the Clerk publishable key
2. Clerk handles authentication — signed-out users see a marketing page, signed-in users see the app
3. Users select 1-3 topics and a conversation mode, then hit play
4. The server resolves the mode to an ElevenLabs agent ID, builds a system prompt with topic constraints and any uploaded knowledge base context, and returns a conversation token
5. The frontend establishes a WebRTC connection to the ElevenLabs agent for real-time voice conversation
6. Usage is tracked per conversation in Convex, with plan-based minute limits

## License

MIT -- see [LICENSE](LICENSE).
