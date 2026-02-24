#!/usr/bin/env bun
// CLI tool to audit ElevenLabs agent configurations
// Usage: bun run src/api/auditAgents.cli.ts

import { auditAgents } from "./auditAgents";

async function main() {
  console.log("Auditing ElevenLabs agent configurations...\n");

  try {
    const report = await auditAgents();

    for (const result of report.results) {
      const status = result.issues.length === 0 ? "OK" : "ISSUES FOUND";
      console.log(`--- ${result.mode.toUpperCase()} Mode (${result.agentId}) [${status}] ---`);

      if (result.name) console.log(`  Name:         ${result.name}`);
      if (result.ttsModel) console.log(`  TTS Model:    ${result.ttsModel}`);
      if (result.llmProvider) console.log(`  LLM Provider: ${result.llmProvider}`);
      if (result.llmModel) console.log(`  LLM Model:    ${result.llmModel}`);
      if (result.sttModel) console.log(`  STT Model:    ${result.sttModel}`);
      if (result.voiceId) console.log(`  Voice ID:     ${result.voiceId}`);

      if (result.issues.length > 0) {
        console.log("  Issues:");
        for (const issue of result.issues) {
          console.log(`    - ${issue}`);
        }
      }

      console.log();
    }

    console.log(`Summary: ${report.summary.withIssues}/${report.summary.total} agents have issues.`);

    if (report.summary.withIssues > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Audit failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
