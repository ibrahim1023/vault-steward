import { describe, expect, it, vi } from "vitest";

import {
  createOpenAIProvider,
  OPENAI_API_BASE_URL
} from "../../src/model-provider/local-provider.js";
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

  it("uses JSON-mode-compatible input for an OpenAI readiness check", async () => {
    const provider = createOpenAIProvider(
      {
        kind: "openai",
        endpoint: OPENAI_API_BASE_URL,
        model: "gpt-4o-mini",
        apiKey: "sk-test-key",
        timeoutMs: 40,
        maxResponseBytes: 200
      },
      vi.fn(async (_url: string, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as { input: string };
        return request.input.toLowerCase().includes("json")
          ? new Response(
              JSON.stringify({
                status: "completed",
                output: [
                  {
                    type: "message",
                    status: "completed",
                    role: "assistant",
                    content: [{ type: "output_text", text: '{"ready":true}', annotations: [] }]
                  }
                ]
              })
            )
          : new Response(JSON.stringify({ error: { message: "JSON input required" } }), {
              status: 400
            });
      })
    );

    await expect(checkModelReadiness(provider)).resolves.toMatchObject({
      available: true,
      structuredOutput: true,
      provider: "openai"
    });
  });
});
