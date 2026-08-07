/**
 * The wire contract for `GET /api/config`, plus the mode vocabulary it is keyed
 * by. Declared once, here, because both sides of the wire need it: the server
 * builds a `ConfigStatus` in ../api/config.ts and the browser reads one in
 * ../components/LandingPage.tsx. Two copies drifted apart once already.
 *
 * ZERO DEPENDENCIES, deliberately. Anything imported here would be reachable
 * from both the server and the browser bundle, so this file must not pull in
 * React, lucide, `bun:sqlite`, or `process.env`. `ConversationMode` lives here
 * rather than in ModeSelector.tsx for exactly that reason; ModeSelector
 * re-exports it so component imports keep working.
 */

/** The three podcast hosts. Also the key space of every per-mode record. */
export type ConversationMode = "fun" | "edu" | "deep";

export interface ConfigStatus {
  hasApiKey: boolean;
  apiKeySource: "session" | "env" | "none";
  apiKeyPreview: string | null;
  agentIds: Record<ConversationMode, boolean>;
  missingAgentModes: ConversationMode[];
}
