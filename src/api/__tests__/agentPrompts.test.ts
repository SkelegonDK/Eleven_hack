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

    it("edu mode uses singular phrasing for one topic", () => {
      const msg = AGENT_PROMPTS.edu.buildFirstMessage(["Technology"]);
      expect(msg).toContain("this topic");
    });

    it("edu mode uses plural phrasing for multiple topics", () => {
      const msg = AGENT_PROMPTS.edu.buildFirstMessage(["Technology", "Science"]);
      expect(msg).toContain("these topics");
    });

    it("deep mode uses singular phrasing for one theme", () => {
      const msg = AGENT_PROMPTS.deep.buildFirstMessage(["Philosophy"]);
      expect(msg).toContain("this theme");
    });

    it("deep mode uses plural phrasing for multiple themes", () => {
      const msg = AGENT_PROMPTS.deep.buildFirstMessage(["Philosophy", "History"]);
      expect(msg).toContain("these themes");
    });
  });

  describe("systemPrompt content", () => {
    it("fun mode contains roast safety rules", () => {
      expect(AGENT_PROMPTS.fun.systemPrompt).toContain("ROAST SAFETY RULES");
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
      for (const mode of ["fun", "edu", "deep"] as const) {
        expect(AGENT_PROMPTS[mode].systemPrompt).toContain("RULES");
      }
    });

    it("edu mode emphasizes patience and clarity", () => {
      const prompt = AGENT_PROMPTS.edu.systemPrompt;
      expect(prompt).toContain("Patient");
      expect(prompt).toContain("Never make anyone feel dumb");
    });

    it("deep mode emphasizes empathy and safety", () => {
      const prompt = AGENT_PROMPTS.deep.systemPrompt;
      expect(prompt).toContain("empathetic");
      expect(prompt).toContain("psychological safety");
    });
  });
});
