import { describe, expect, it } from "vitest";

import {
  buildFindingExplanationPrompt,
  explainFinding
} from "../../src/agents/finding-explanation.js";

const finding = {
  schemaVersion: 1 as const,
  id: "finding",
  scanId: "scan",
  type: "policy" as const,
  severity: "high" as const,
  evidence: [{ notePath: "Project.md", locator: "line:2", excerpt: "owner: " }],
  affectedNoteIds: ["Project.md"],
  explanation: "Owner is required.",
  suggestedFixes: [],
  confidence: 1,
  status: "open" as const
};

describe("finding explanation", () => {
  it("builds a bounded request from selected cited evidence only", () => {
    const prompt = buildFindingExplanationPrompt(finding);
    expect(prompt).toContain("Project.md");
    expect(prompt).toContain("Owner is required.");
    expect(prompt).not.toContain("unrelated secret note");
    expect(prompt).toContain("Do not suggest edits");
  });

  it("returns only transient provider text or a redacted failure code", async () => {
    await expect(
      explainFinding(
        {
          config: {
            kind: "ollama",
            endpoint: "http://127.0.0.1",
            model: "test",
            timeoutMs: 1,
            maxResponseBytes: 1
          },
          capabilities: [],
          generate: async () => ({
            text: "The cited owner field is empty.",
            model: "test",
            provider: "ollama",
            latencyMs: 3
          })
        },
        finding
      )
    ).resolves.toEqual({ ok: true, text: "The cited owner field is empty.", latencyMs: 3 });
  });

  it("replaces a structured prompt echo with a grounded plain-language explanation", async () => {
    await expect(
      explainFinding(
        {
          config: {
            kind: "ollama",
            endpoint: "http://127.0.0.1",
            model: "test",
            timeoutMs: 1,
            maxResponseBytes: 1
          },
          capabilities: [],
          generate: async () => ({
            text: JSON.stringify({ type: "policy", evidence: finding.evidence }),
            model: "test",
            provider: "ollama",
            latencyMs: 3
          })
        },
        finding
      )
    ).resolves.toEqual({
      ok: true,
      text: "The cited evidence owner:  appears in Project.md (line:2). Owner is required.",
      latencyMs: 3
    });
  });
});
