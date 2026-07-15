import { describe, expect, it } from "vitest";

import { createGovernedIntegritySession } from "../../src/plugin/main.js";
import type { LocalProvider } from "../../src/model-provider/local-provider.js";

const provider: LocalProvider = {
  config: {
    kind: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "test",
    timeoutMs: 100,
    maxResponseBytes: 1000
  },
  capabilities: ["structured-output"],
  generate: async () => ({
    text: '{"candidates":[]}',
    provider: "ollama",
    model: "test",
    latencyMs: 1
  })
};

describe("governed scans", () => {
  it("requires the local semantic-analysis stage before returning deterministic findings", async () => {
    const session = createGovernedIntegritySession([provider]);
    await expect(
      session.scan([{ path: "Home.md", content: "[[Missing]]" }])
    ).resolves.toMatchObject({
      findings: [expect.objectContaining({ type: "broken-reference" })],
      semanticAnalysis: { completed: true, modelAvailable: true, toolCalls: 1 }
    });
    await expect(
      createGovernedIntegritySession([]).scan([{ path: "Home.md", content: "[[Missing]]" }])
    ).rejects.toThrow("required local model");
  });
});
