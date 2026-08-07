import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import {
  ConfigError,
  getAgentForMode,
  getConversationToken,
  buildFullPrompt,
  resolveSubjectNames,
} from "../agents";

// Store original env values for restoration
const originalEnv = { ...process.env };

beforeEach(() => {
  // Restore env between tests
  process.env.ELEVENLABS_AGENT_ID_FUN = "agent_fun_123";
  process.env.ELEVENLABS_AGENT_ID_EDU = "agent_edu_456";
  process.env.ELEVENLABS_AGENT_ID_DEEP = "agent_deep_789";
  process.env.ELEVENLABS_API_KEY = "test_api_key";
});

describe("resolveSubjectNames", () => {
  it("maps known subject IDs to display names", () => {
    const names = resolveSubjectNames(["tech", "science"]);
    expect(names).toEqual(["Technology", "Science"]);
  });

  it("passes through unknown IDs as-is", () => {
    const names = resolveSubjectNames(["tech", "custom-topic"]);
    expect(names).toEqual(["Technology", "custom-topic"]);
  });

  it("returns empty array for empty input", () => {
    const names = resolveSubjectNames([]);
    expect(names).toEqual([]);
  });

  it("maps all known subject IDs", () => {
    const allIds = ["tech", "science", "history", "philosophy", "business", "health", "arts"];
    const names = resolveSubjectNames(allIds);
    expect(names).toEqual([
      "Technology",
      "Science",
      "History",
      "Philosophy",
      "Business",
      "Health & Wellness",
      "Arts & Culture",
    ]);
  });
});

describe("buildFullPrompt", () => {
  it("includes base system prompt for each mode", () => {
    const prompt = buildFullPrompt("fun", [], []);
    expect(prompt).toContain("PODU");
    expect(prompt).toContain("Harry More");
  });

  it("includes topic restriction when subjects are provided", () => {
    const prompt = buildFullPrompt("edu", ["Technology", "Science"], []);
    expect(prompt).toContain("TOPIC FOCUS (NON-NEGOTIABLE)");
    expect(prompt).toContain("Technology, Science");
    expect(prompt).toContain("Discuss ONLY these topics");
  });

  it("omits topic restriction when no subjects are provided", () => {
    const prompt = buildFullPrompt("deep", [], []);
    expect(prompt).not.toContain("TOPIC FOCUS (NON-NEGOTIABLE)");
  });

  it("includes document context when documents are passed in", () => {
    const prompt = buildFullPrompt("fun", ["Technology"], [
      {
        id: "d1",
        name: "test.txt",
        content: "Test document content",
        uploadedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    expect(prompt).toContain("reference documents");
    expect(prompt).toContain("test.txt");
    expect(prompt).toContain("Test document content");
  });

  it("omits document context when no documents are passed in", () => {
    const prompt = buildFullPrompt("edu", ["Science"], []);
    // Should not contain the document injection header
    expect(prompt).not.toContain("reference documents");
  });
});

describe("getAgentForMode", () => {
  it("returns correct agent ID for fun mode", async () => {
    const result = await getAgentForMode({ mode: "fun", subjects: [], documents: [] });
    expect(result.agentId).toBe(process.env.ELEVENLABS_AGENT_ID_FUN!);
  });

  it("returns correct agent ID for edu mode", async () => {
    const result = await getAgentForMode({ mode: "edu", subjects: [], documents: [] });
    expect(result.agentId).toBe(process.env.ELEVENLABS_AGENT_ID_EDU!);
  });

  it("returns correct agent ID for deep mode", async () => {
    const result = await getAgentForMode({ mode: "deep", subjects: [], documents: [] });
    expect(result.agentId).toBe(process.env.ELEVENLABS_AGENT_ID_DEEP!);
  });

  it("returns systemPrompt and firstMessage in response", async () => {
    const result = await getAgentForMode({ mode: "fun", subjects: ["tech"], documents: [] });
    expect(result.systemPrompt).toBeTruthy();
    expect(result.firstMessage).toBeTruthy();
    expect(result.systemPrompt).toContain("PODU");
    expect(result.firstMessage).toContain("Technology");
  });

  it("includes topic restriction in systemPrompt when subjects given", async () => {
    const result = await getAgentForMode({ mode: "edu", subjects: ["science", "history"], documents: [] });
    expect(result.systemPrompt).toContain("TOPIC FOCUS (NON-NEGOTIABLE)");
    expect(result.systemPrompt).toContain("Science, History");
  });

  it("throws for unconfigured mode", async () => {
    delete process.env.ELEVENLABS_AGENT_ID_FUN;
    await expect(getAgentForMode({ mode: "fun", subjects: [], documents: [] })).rejects.toThrow(
      "No agent ID configured for FUN mode"
    );
  });
});

describe("getConversationToken", () => {
  it("calls ElevenLabs API with correct headers", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "test_token_123" }), { status: 200 })
    );

    const token = await getConversationToken("agent_123", "test_api_key");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_123",
      {
        method: "GET",
        headers: {
          "xi-api-key": "test_api_key",
        },
        signal: expect.any(AbortSignal),
      }
    );
    expect(token).toBe("test_token_123");

    mockFetch.mockRestore();
  });

  it("URL-encodes the agent ID", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "t" }), { status: 200 })
    );

    await getConversationToken("agent 1&x=2", "test_api_key");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(
      "https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent+1%26x%3D2"
    );

    mockFetch.mockRestore();
  });

  it("throws when API key is missing", async () => {
    await expect(getConversationToken("agent_123", null)).rejects.toThrow(
      "No ElevenLabs API key is configured"
    );
  });

  it("throws on 401 with invalid-key guidance", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    await expect(getConversationToken("agent_123", "bad_key")).rejects.toThrow(
      "ElevenLabs rejected the stored API key"
    );

    mockFetch.mockRestore();
  });

  it("throws on non-OK response", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Server error", { status: 500 })
    );

    await expect(getConversationToken("agent_123", "good_key")).rejects.toThrow(
      "ElevenLabs returned HTTP 500"
    );

    mockFetch.mockRestore();
  });

  it("wraps a network rejection as an upstream_error ConfigError", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new TypeError("Unable to connect. Is the computer able to access the url?")
    );

    let thrown: unknown;
    try {
      await getConversationToken("agent_123", "good_key");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).code).toBe("upstream_error");
    expect((thrown as ConfigError).message).toContain("Could not reach ElevenLabs");

    mockFetch.mockRestore();
  });

  it("wraps a request timeout as an upstream_error ConfigError", async () => {
    const timeoutError = new Error("The operation timed out.");
    timeoutError.name = "TimeoutError";
    const mockFetch = spyOn(globalThis, "fetch").mockRejectedValueOnce(timeoutError);

    let thrown: unknown;
    try {
      await getConversationToken("agent_123", "good_key");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).code).toBe("upstream_error");
    expect((thrown as ConfigError).message).toContain("timed out");

    mockFetch.mockRestore();
  });

  it("wraps an unparseable success body as an upstream_error ConfigError", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>not json</html>", { status: 200 })
    );

    let thrown: unknown;
    try {
      await getConversationToken("agent_123", "good_key");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).code).toBe("upstream_error");

    mockFetch.mockRestore();
  });

  it("returns token from successful response", async () => {
    const mockFetch = spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "my_token" }), { status: 200 })
    );

    const token = await getConversationToken("agent_456", "test_api_key");
    expect(token).toBe("my_token");

    mockFetch.mockRestore();
  });
});
