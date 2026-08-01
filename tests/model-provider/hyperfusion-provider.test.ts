import { describe, expect, it, vi } from "vitest";

import {
  createHyperFusionProvider,
  createModelProvider,
  HYPERFUSION_API_BASE_URL,
  type HyperFusionProviderConfig
} from "../../src/model-provider/local-provider.js";

const config: HyperFusionProviderConfig = {
  kind: "hyperfusion",
  endpoint: HYPERFUSION_API_BASE_URL,
  model: "qwen/qwen3-32b",
  apiKey: "hf-test-key",
  timeoutMs: 1_000,
  maxResponseBytes: 1_000
};

describe("HyperFusion model provider", () => {
  it("uses the fixed Chat Completions endpoint and extracts assistant content", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { role: "assistant", content: '{"ready":true}' } }]
        })
      )
    );
    const provider = createHyperFusionProvider(config, fetcher);

    await expect(
      provider.generate({ prompt: "check", maxOutputTokens: 32 })
    ).resolves.toMatchObject({ text: '{"ready":true}', provider: "hyperfusion" });

    expect(fetcher.mock.calls[0]?.[0]).toBe(`${HYPERFUSION_API_BASE_URL}/chat/completions`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      redirect: "error",
      headers: {
        authorization: "Bearer hf-test-key",
        "content-type": "application/json"
      }
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      model: "qwen/qwen3-32b",
      messages: [
        {
          role: "system",
          content:
            "Return only a valid JSON object. Do not include reasoning, commentary, tools, or external data."
        },
        { role: "user", content: "check" }
      ],
      max_tokens: 32,
      enable_thinking: false,
      response_format: { type: "json_object" }
    });
  });

  it("rejects blank keys, non-HyperFusion origins, malformed responses, and oversized bodies", async () => {
    expect(() => createHyperFusionProvider({ ...config, apiKey: "" })).toThrow("configuration");
    expect(() =>
      createHyperFusionProvider({
        ...config,
        endpoint: "https://example.com/v1" as typeof HYPERFUSION_API_BASE_URL
      })
    ).toThrow("configuration");

    const malformed = createHyperFusionProvider(
      config,
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {} }] })))
    );
    await expect(malformed.generate({ prompt: "check", maxOutputTokens: 32 })).rejects.toThrow(
      "unavailable"
    );

    const oversized = createHyperFusionProvider(
      { ...config, maxResponseBytes: 4 },
      vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-length": "5" } }))
    );
    await expect(oversized.generate({ prompt: "check", maxOutputTokens: 32 })).rejects.toThrow(
      "response size"
    );
  });

  it("creates HyperFusion through the selected-provider factory", () => {
    expect(createModelProvider(config).config.kind).toBe("hyperfusion");
  });
});
