import { describe, expect, it } from "vitest";

import { AgentResultCache, LocalAgentCoordinator } from "../../src/agents/coordinator.js";
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
  it("fails a governed scan closed when no local model provider is configured", async () => {
    const result = await new LocalAgentCoordinator([]).run({
      scanId: "scan",
      now: "2026-07-13T00:00:00Z",
      evidence: [],
      propositions: [],
      stalenessRecords: [],
      decisions: []
    });
    expect(result).toMatchObject({
      modelRequired: true,
      modelAvailable: false,
      completed: false,
      limitations: ["local-model-provider-required"]
    });
  });

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
    expect(result.completed).toBe(true);
    expect(result.modelAvailable).toBe(true);
    expect(result.toolCalls).toBe(1);
  });

  it("reuses only an exact declared model context across scan IDs", async () => {
    let calls = 0;
    const countingProvider: LocalProvider = {
      ...provider,
      generate: async () => {
        calls += 1;
        return { text: '{"candidates":[]}', model: "test", provider: "ollama", latencyMs: 1 };
      }
    };
    const coordinator = new LocalAgentCoordinator([countingProvider], new AgentResultCache());
    const input = {
      now: "2026-07-13T00:00:00Z",
      evidence: [{ notePath: "A.md", locator: "line:1", excerpt: "Ada Lovelace" }],
      propositions: [],
      stalenessRecords: [],
      decisions: []
    };

    await coordinator.run({ ...input, scanId: "scan-1" });
    const reused = await coordinator.run({ ...input, scanId: "scan-2" });
    const changed = await coordinator.run({
      ...input,
      scanId: "scan-3",
      evidence: [{ notePath: "A.md", locator: "line:1", excerpt: "Ada Byron" }]
    });

    expect(calls).toBe(2);
    expect(reused).toMatchObject({ toolCalls: 0, reusedRoutes: ["entity"] });
    expect(changed).toMatchObject({ toolCalls: 1, reusedRoutes: [] });
  });
});
