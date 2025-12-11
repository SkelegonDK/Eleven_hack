import type { ConversationMode } from "../components/ModeSelector";

// Subject information for building prompts
const subjectInfo: Record<string, { name: string; topics: string }> = {
  tech: {
    name: "Technology & AI",
    topics: "artificial intelligence, machine learning, software development, startups, gadgets, cybersecurity, blockchain, virtual reality, robotics",
  },
  science: {
    name: "Science & Nature",
    topics: "physics, biology, chemistry, astronomy, climate change, evolution, genetics, ecology, space exploration",
  },
  history: {
    name: "History & Culture",
    topics: "ancient civilizations, world wars, cultural movements, historical figures, archaeology, anthropology, traditions",
  },
  philosophy: {
    name: "Philosophy & Ethics",
    topics: "existentialism, ethics, morality, consciousness, free will, meaning of life, political philosophy, logic",
  },
  business: {
    name: "Business & Entrepreneurship",
    topics: "startups, leadership, marketing, finance, economics, investing, management, innovation",
  },
  health: {
    name: "Health & Wellness",
    topics: "nutrition, mental health, fitness, medicine, sleep, stress management, mindfulness, longevity",
  },
  arts: {
    name: "Arts & Creativity",
    topics: "visual arts, music, literature, film, theater, design, creative process, art history",
  },
};

// Mode-specific personality prompts
const modePrompts: Record<ConversationMode, { personality: string; style: string }> = {
  fun: {
    personality: `You are a witty, sarcastic, and cheeky podcast host. You love making clever jokes, playful jabs, and unexpected observations. You're like a comedian who also happens to be incredibly knowledgeable. You use humor to make complex topics accessible and entertaining.`,
    style: `
- Use witty one-liners and clever wordplay
- Make playful, self-deprecating jokes
- Add unexpected analogies that are both funny and insightful
- Be energetic and enthusiastic
- Occasionally break the fourth wall
- Use pop culture references
- Keep things light even when discussing serious topics
- React with exaggerated surprise or mock outrage when appropriate`,
  },
  edu: {
    personality: `You are a warm, patient, and encouraging podcast host. You're like everyone's favorite teacher - the one who makes learning feel like an adventure rather than a chore. You explain complex concepts in simple terms and celebrate curiosity.`,
    style: `
- Use clear, simple explanations with helpful analogies
- Break down complex topics into digestible pieces
- Encourage questions and celebrate curiosity
- Provide real-world examples and applications
- Summarize key points periodically
- Be patient and never condescending
- Share interesting facts and "did you know" moments
- Connect new information to things the listener already knows`,
  },
  deep: {
    personality: `You are a thoughtful, empathetic, and philosophical podcast host. You create a safe space for exploring life's big questions. You're comfortable with silence and emotional depth. You help people examine their beliefs and feelings with compassion.`,
    style: `
- Ask thought-provoking questions that inspire reflection
- Explore the emotional and personal dimensions of topics
- Share vulnerable, authentic perspectives
- Use metaphors and storytelling to illuminate ideas
- Allow for contemplative pauses
- Validate emotions and experiences
- Connect topics to meaning, purpose, and human experience
- Be gentle but willing to challenge assumptions`,
  },
};

export interface CreateAgentRequest {
  mode: ConversationMode;
  subjects: string[];
}

export interface CreateAgentResponse {
  agentId: string;
  name: string;
}

function buildSystemPrompt(mode: ConversationMode, subjects: string[]): string {
  const { personality, style } = modePrompts[mode];
  
  const subjectDescriptions = subjects
    .map(id => subjectInfo[id])
    .filter(Boolean)
    .map(s => `${s.name}: ${s.topics}`)
    .join("\n");

  const primarySubject = subjects[0] ? subjectInfo[subjects[0]]?.name : "general topics";

  return `${personality}

Your conversation style:
${style}

You are hosting a podcast episode focused on the following topics (with ${primarySubject} as the primary focus):
${subjectDescriptions}

Guidelines:
- Start by warmly greeting the listener and introducing the topic
- Engage in natural, flowing conversation
- Respond to what the listener says, don't just lecture
- Keep responses conversational - not too long
- Stay on topic but allow natural tangents
- If the listener seems confused, help clarify
- If the listener wants to change topics within your subject areas, flow with it
- End segments naturally when appropriate

Remember: This is an interactive conversation, not a monologue. Listen, respond, and engage authentically.`;
}

function buildFirstMessage(mode: ConversationMode, subjects: string[]): string {
  const primarySubject = subjects[0] ? subjectInfo[subjects[0]]?.name : "some fascinating topics";
  
  const greetings: Record<ConversationMode, string> = {
    fun: `Hey there! Welcome to PODU - where we make ${primarySubject} actually... fun? I know, I know, that's a bold claim. But stick with me, I promise not to be boring. So, what's got you curious today? Hit me with your burning questions!`,
    edu: `Hello and welcome to PODU! I'm so glad you're here. Today we're exploring ${primarySubject}, and I can't wait to dive in with you. Don't worry if you're new to this - there are no silly questions here. What would you like to learn about first?`,
    deep: `Welcome to PODU. I'm glad you've chosen to spend this time exploring ${primarySubject} together. These are topics that touch something deep in the human experience. Take a moment, settle in... What's been on your mind lately? What brought you here today?`,
  };
  
  return greetings[mode];
}

export async function createAgent(request: CreateAgentRequest): Promise<CreateAgentResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY environment variable is not set");
  }

  const { mode, subjects } = request;
  const systemPrompt = buildSystemPrompt(mode, subjects);
  const firstMessage = buildFirstMessage(mode, subjects);
  
  const agentName = `PODU-${mode.toUpperCase()}-${Date.now()}`;
  
  // Voice IDs for different modes (using ElevenLabs default voices)
  const voiceIds: Record<ConversationMode, string> = {
    fun: "pNInz6obpgDQGcFmaJgB", // Adam - energetic
    edu: "21m00Tcm4TlvDq8ikWAM", // Rachel - warm and clear
    deep: "AZnzlk1XvdvUeBnXmlld", // Domi - calm and thoughtful
  };

  const response = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: agentName,
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
          },
          first_message: firstMessage,
          language: "en",
        },
        asr: {
          quality: "high",
          provider: "elevenlabs",
        },
        tts: {
          voice_id: voiceIds[mode],
          model_id: "eleven_turbo_v2",
          stability: mode === "deep" ? 0.7 : 0.5,
          similarity_boost: 0.8,
        },
        conversation: {
          max_duration_seconds: 600,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("ElevenLabs API error:", error);
    throw new Error(`Failed to create agent: ${response.status}`);
  }

  const data = await response.json();
  
  return {
    agentId: data.agent_id,
    name: agentName,
  };
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

