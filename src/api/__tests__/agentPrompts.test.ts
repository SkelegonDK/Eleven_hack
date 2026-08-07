import { describe, it, expect } from "bun:test";
import { AGENT_PROMPTS } from "../agentPrompts";

describe("AGENT_PROMPTS", () => {
  it("defines all three modes", () => {
    expect(AGENT_PROMPTS.fun).toBeDefined();
    expect(AGENT_PROMPTS.edu).toBeDefined();
    expect(AGENT_PROMPTS.deep).toBeDefined();
  });

  it("each mode has required fields", () => {
    for (const mode of ["fun", "edu", "deep"] as const) {
      const prompt = AGENT_PROMPTS[mode];
      expect(prompt.name).toBeTruthy();
      expect(typeof prompt.name).toBe("string");
      expect(prompt.systemPrompt).toBeTruthy();
      expect(typeof prompt.systemPrompt).toBe("string");
      expect(typeof prompt.buildFirstMessage).toBe("function");
    }
  });

  describe("buildFirstMessage", () => {
    it("fun mode includes subject names", () => {
      const msg = AGENT_PROMPTS.fun.buildFirstMessage(["Technology", "Science"]);
      expect(msg).toContain("Technology");
      expect(msg).toContain("Science");
    });

    it("edu mode includes subject names", () => {
      const msg = AGENT_PROMPTS.edu.buildFirstMessage(["History"]);
      expect(msg).toContain("History");
    });

    it("deep mode includes subject names", () => {
      const msg = AGENT_PROMPTS.deep.buildFirstMessage(["Philosophy", "Arts & Culture"]);
      expect(msg).toContain("Philosophy");
      expect(msg).toContain("Arts & Culture");
    });

    it("fun mode handles empty subjects gracefully", () => {
      const msg = AGENT_PROMPTS.fun.buildFirstMessage([]);
      expect(msg).toBeTruthy();
      expect(msg.length).toBeGreaterThan(50);
      // Should have a fallback phrase
      expect(msg).toContain("whatever");
    });

    it("edu mode handles empty subjects gracefully", () => {
      const msg = AGENT_PROMPTS.edu.buildFirstMessage([]);
      expect(msg).toBeTruthy();
      expect(msg.length).toBeGreaterThan(50);
    });

    it("deep mode handles empty subjects gracefully", () => {
      const msg = AGENT_PROMPTS.deep.buildFirstMessage([]);
      expect(msg).toBeTruthy();
      expect(msg.length).toBeGreaterThan(50);
    });

    it("edu mode distinguishes singular from plural subjects", () => {
      // Assert the length===1 branch actually branches — not the exact noun,
      // which is free to change in a persona rewrite.
      const one = AGENT_PROMPTS.edu.buildFirstMessage(["Technology"]);
      const many = AGENT_PROMPTS.edu.buildFirstMessage(["Technology", "Science"]);
      expect(one).toContain("Technology");
      expect(many).toContain("Technology");
      expect(many).toContain("Science");
      expect(one).not.toBe(many);
    });

    it("deep mode distinguishes singular from plural themes", () => {
      const one = AGENT_PROMPTS.deep.buildFirstMessage(["Philosophy"]);
      const many = AGENT_PROMPTS.deep.buildFirstMessage(["Philosophy", "History"]);
      expect(one).toContain("Philosophy");
      expect(many).toContain("Philosophy");
      expect(many).toContain("History");
      expect(one).not.toBe(many);
    });

    it("is deterministic", () => {
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].buildFirstMessage(["Technology"])).toBe(
          AGENT_PROMPTS[mode].buildFirstMessage(["Technology"]),
        );
      }
    });
  });

  describe("systemPrompt content", () => {
    it("fun mode contains a safety rules section", () => {
      expect(AGENT_PROMPTS.fun.systemPrompt).toContain("SAFETY RULES");
    });

    it("fun mode has Harry More host name", () => {
      expect(AGENT_PROMPTS.fun.systemPrompt).toContain("Harry More");
    });

    it("all modes contain PODCAST HOST STRUCTURE", () => {
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt).toContain("PODCAST HOST STRUCTURE");
      }
    });

    it("all modes contain PODU branding", () => {
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt).toContain("PODU");
      }
    });

    it("all modes contain personality traits section", () => {
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt).toContain("PERSONALITY TRAITS");
      }
    });

    it("all modes contain conversation style section", () => {
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt).toContain("CONVERSATION STYLE");
      }
    });

    it("all modes contain rules section", () => {
      // Anchored to the line start so it can't be satisfied by
      // "SAFETY RULES" / "ANTI-PASSIVITY RULES" etc.
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt).toContain("\nRULES:");
      }
    });

    it("edu mode emphasizes Socratic challenge without humiliation", () => {
      const prompt = AGENT_PROMPTS.edu.systemPrompt;
      expect(prompt).toContain("SOCRATIC METHOD");
      expect(prompt).toContain("Never make someone feel stupid");
    });

    it("deep mode emphasizes emotional perception and honesty", () => {
      const prompt = AGENT_PROMPTS.deep.systemPrompt;
      expect(prompt).toContain("Emotionally perceptive");
      expect(prompt).toContain("sit with discomfort");
    });

    it("every systemPrompt is non-empty and deterministic", () => {
      // Ties to the buildFullPrompt override guarantee: ElevenLabs silently
      // discards empty overrides, so an empty prompt is a silent failure.
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt.trim().length).toBeGreaterThan(0);
        expect(AGENT_PROMPTS[mode].systemPrompt).toBe(AGENT_PROMPTS[mode].systemPrompt);
      }
    });
  });
});
