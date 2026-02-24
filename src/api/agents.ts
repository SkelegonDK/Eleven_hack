import type { ConversationMode } from "../components/ModeSelector";
import { AGENT_PROMPTS } from "./agentPrompts";
import { getDocumentsContext } from "./knowledgebase";

// Subject ID → display name mapping (must match SubjectSelector)
const SUBJECT_NAMES: Record<string, string> = {
  tech: "Technology",
  science: "Science",
  history: "History",
  philosophy: "Philosophy",
  business: "Business",
  health: "Health & Wellness",
  arts: "Arts & Culture",
};

// Agent ID env var names by mode
const AGENT_ID_ENV_VARS: Record<ConversationMode, string> = {
  fun: "ELEVENLABS_AGENT_ID_FUN",
  edu: "ELEVENLABS_AGENT_ID_EDU",
  deep: "ELEVENLABS_AGENT_ID_DEEP",
};

export interface GetAgentRequest {
  mode: ConversationMode;
  subjects: string[];
}

export interface GetAgentResponse {
  agentId: string;
  systemPrompt: string;
  firstMessage: string;
}

export function buildFullPrompt(mode: ConversationMode, subjectNames: string[]): string {
  const basePrompt = AGENT_PROMPTS[mode].systemPrompt;

  const topicSection = subjectNames.length > 0
    ? `\n\nTOPIC FOCUS (NON-NEGOTIABLE):\nThe user has selected these specific topics: ${subjectNames.join(", ")}.\n- Discuss ONLY these topics.\n- Do NOT bring up artificial intelligence, machine learning, or any subject not in the list above, even tangentially.\n- If the conversation drifts off-topic, steer it back to the selected topics.`
    : "";

  const documentsContext = getDocumentsContext();

  return basePrompt + topicSection + documentsContext;
}

export function resolveSubjectNames(subjectIds: string[]): string[] {
  return subjectIds.map(id => SUBJECT_NAMES[id] || id);
}

export async function getAgentForMode(request: GetAgentRequest): Promise<GetAgentResponse> {
  const { mode, subjects } = request;
  const envVar = AGENT_ID_ENV_VARS[mode];
  const agentId = process.env[envVar];

  if (!agentId) {
    throw new Error(`No agent ID configured for mode: ${mode}. Set ELEVENLABS_AGENT_ID_${mode.toUpperCase()} in your .env file.`);
  }

  const subjectNames = resolveSubjectNames(subjects);
  const systemPrompt = buildFullPrompt(mode, subjectNames);
  const firstMessage = AGENT_PROMPTS[mode].buildFirstMessage(subjectNames);

  return { agentId, systemPrompt, firstMessage };
}

export async function getConversationToken(agentId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get conversation token: ${response.status}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}
