import { describe, expect, it } from "vitest";

import { LocalAgentCoordinator } from "../../src/agents/coordinator.js";
import type { LocalProvider } from "../../src/model-provider/local-provider.js";

const provider: LocalProvider = {
  config: {
    kind: "ollama",
    endpoint: "http://localhost:11434",
    model: "test",
    timeoutMs: 100,
    maxResponseBytes: 10_000
  },
  capabilities: ["structured-output"],
  generate: async () => ({
    text: '{"candidates":[]}',
    model: "test",
    provider: "ollama",
    latencyMs: 1
  })
};

describe("local-agent coordinator", () => {
  it("routes only eligible agents once, declares handoffs, and terminates after partial failure", async () => {
    const coordinator = new LocalAgentCoordinator([provider]);
    const result = await coordinator.run({
      scanId: "scan",
      now: "2026-07-13T00:00:00Z",
      evidence: [
        { notePath: "A.md", locator: "line:1", excerpt: "Ada Lovelace" },
        { notePath: "B.md", locator: "line:1", excerpt: "Ada L." }
      ],
      propositions: [],
      stalenessRecords: [],
      decisions: []
    });
    expect(result.routes).toEqual(["entity"]);
    expect(result.handoffs).toEqual([{ agent: "entity", evidenceCount: 2 }]);
    expect(result.terminated).toBe(true);
    expect(result.toolCalls).toBe(1);
  });
});
