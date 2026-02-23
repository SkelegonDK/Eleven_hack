import type { ConversationMode } from "../components/ModeSelector";
export { AGENT_PROMPTS } from "./agentPrompts";

// Agent IDs from environment variables
const agentIds: Record<ConversationMode, string | undefined> = {
  fun: process.env.ELEVENLABS_AGENT_ID_FUN,
  edu: process.env.ELEVENLABS_AGENT_ID_EDU,
  deep: process.env.ELEVENLABS_AGENT_ID_DEEP,
};

export interface GetAgentRequest {
  mode: ConversationMode;
  subjects: string[];
}

export interface GetAgentResponse {
  agentId: string;
}

export async function getAgentForMode(request: GetAgentRequest): Promise<GetAgentResponse> {
  const { mode } = request;
  const agentId = agentIds[mode];
  
  if (!agentId) {
    throw new Error(`No agent ID configured for mode: ${mode}. Set ELEVENLABS_AGENT_ID_${mode.toUpperCase()} in your .env file.`);
  }

  return { agentId };
}

export async function getSignedUrl(agentId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get signed URL: ${response.status}`);
  }

  const data = await response.json();
  return data.signed_url;
}

