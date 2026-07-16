import { describe, expect, it } from "vitest";

import { checkModelReadiness } from "../../src/model-provider/readiness.js";

describe("model readiness", () => {
  it("reports bounded profile data and structured-output readiness", async () => {
    const provider = {
      config: {
        kind: "ollama" as const,
        endpoint: "http://127.0.0.1",
        model: "test",
        timeoutMs: 40,
        maxResponseBytes: 200
      },
      capabilities: ["structured-output"],
      generate: async () => ({
        text: '{"ready":true}',
        provider: "ollama" as const,
        model: "test",
        latencyMs: 7
      })
    };
    await expect(checkModelReadiness(provider)).resolves.toEqual({
      available: true,
      structuredOutput: true,
      provider: "ollama",
      model: "test",
      timeoutMs: 40,
      maxResponseBytes: 200,
      latencyMs: 7
    });
  });

  it("does not expose provider errors", async () => {
    const provider = {
      config: {
        kind: "ollama" as const,
        endpoint: "http://127.0.0.1",
        model: "test",
        timeoutMs: 40,
        maxResponseBytes: 200
      },
      capabilities: [],
      generate: async () => Promise.reject(new Error("secret transport detail"))
    };
    await expect(checkModelReadiness(provider)).resolves.toMatchObject({
      available: false,
      failureCode: "provider-unavailable"
    });
  });
});
