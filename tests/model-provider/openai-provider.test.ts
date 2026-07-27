import { describe, expect, it, vi } from "vitest";

import {
  createModelProvider,
  createOpenAIProvider,
  OPENAI_API_BASE_URL,
  type OpenAIProviderConfig
} from "../../src/model-provider/local-provider.js";

const config: OpenAIProviderConfig = {
  kind: "openai",
  endpoint: OPENAI_API_BASE_URL,
  model: "gpt-4o-mini",
  apiKey: "sk-test-key",
  timeoutMs: 1_000,
  maxResponseBytes: 1_000
};

describe("OpenAI model provider", () => {
  it("uses the fixed Chat Completions endpoint with no server-side storage", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"ready":true}' } }] }))
      );
    const provider = createOpenAIProvider(config, fetcher);

    await expect(
      provider.generate({ prompt: "check", maxOutputTokens: 32 })
    ).resolves.toMatchObject({
      text: '{"ready":true}',
      provider: "openai"
    });

    expect(fetcher.mock.calls[0]?.[0]).toBe(`${OPENAI_API_BASE_URL}/chat/completions`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      redirect: "error",
      headers: {
        authorization: "Bearer sk-test-key",
        "content-type": "application/json"
      }
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_completion_tokens: 32,
      store: false
    });
  });

  it("rejects blank keys, non-OpenAI origins, malformed responses, and oversized bodies", async () => {
    expect(() => createOpenAIProvider({ ...config, apiKey: "" })).toThrow("configuration");
    expect(() =>
      createOpenAIProvider({
        ...config,
        endpoint: "https://example.com/v1" as typeof OPENAI_API_BASE_URL
      })
    ).toThrow("configuration");

    const malformed = createOpenAIProvider(
      config,
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] })))
    );
    await expect(malformed.generate({ prompt: "check", maxOutputTokens: 32 })).rejects.toThrow(
      "unavailable"
    );

    const oversized = createOpenAIProvider(
      { ...config, maxResponseBytes: 4 },
      vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-length": "5" } }))
    );
    await expect(oversized.generate({ prompt: "check", maxOutputTokens: 32 })).rejects.toThrow(
      "response size"
    );
  });

  it("creates either supported provider through the selected-provider factory", () => {
    expect(createModelProvider(config).config.kind).toBe("openai");
  });
});
