import { describe, expect, it, vi } from "vitest";
import { generateStructured } from "../../src/model-provider/structured.js";
import type { ModelProvider } from "../../src/model-provider/local-provider.js";

const provider = (responses: string[], prompts?: string[]): ModelProvider => ({
  config: {
    kind: "ollama",
    endpoint: "http://localhost:1",
    model: "test",
    timeoutMs: 1,
    maxResponseBytes: 1000
  },
  capabilities: ["structured-output"],
  generate: async (request) => {
    prompts?.push(request.prompt);
    return {
      text: responses.shift() ?? "",
      model: "test",
      provider: "ollama",
      latencyMs: 2
    };
  }
});
const validate = (value: unknown): value is { label: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { label?: unknown }).label === "string";

describe("structured local output", () => {
  it("repairs malformed output once and records only redacted trace metadata", async () => {
    const prompts: string[] = [];
    const result = await generateStructured(
      [provider(["not json", '{"label":"ok"}'], prompts)],
      { prompt: "secret note content", maxOutputTokens: 10 },
      validate
    );
    expect(result).toMatchObject({
      ok: true,
      value: { label: "ok" },
      trace: { retries: 1, provider: "ollama" }
    });
    expect(JSON.stringify(result.trace)).not.toContain("secret");
    expect(prompts[1]).toContain("exactly one JSON object");
  });
  it("retries one transient provider failure within the fixed two-attempt budget", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary provider failure"))
      .mockResolvedValueOnce({
        text: '{"label":"ok"}',
        model: "test",
        provider: "ollama" as const,
        latencyMs: 2
      });
    const source: ModelProvider = {
      ...provider([]),
      generate
    };

    await expect(
      generateStructured([source], { prompt: "x", maxOutputTokens: 10 }, validate)
    ).resolves.toMatchObject({ ok: true, value: { label: "ok" }, trace: { retries: 1 } });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].prompt).toBe("x");
  });
  it("keeps repeated provider failures typed and fail-closed", async () => {
    const source: ModelProvider = {
      ...provider([]),
      generate: vi.fn().mockRejectedValue(new Error("unavailable"))
    };

    await expect(
      generateStructured([source], { prompt: "x", maxOutputTokens: 10 }, validate)
    ).resolves.toMatchObject({ ok: false, error: "provider-unavailable" });
  });
  it("accepts a JSON object wrapped in harmless model formatting", async () => {
    const result = await generateStructured(
      [provider(['Here is the result:\n```json\n{"label":"ok"}\n```'])],
      { prompt: "x", maxOutputTokens: 10 },
      validate
    );
    expect(result).toMatchObject({ ok: true, value: { label: "ok" } });
  });
  it("does not treat malformed framed content as structured output", async () => {
    const result = await generateStructured(
      [provider(['```json\n{"label":\n```', "commentary without JSON"])],
      { prompt: "x", maxOutputTokens: 10 },
      validate
    );
    expect(result).toMatchObject({ ok: false, error: "structured-output-invalid" });
  });
  it("bounds malformed JSON recovery while retaining ordinary wrapped JSON", async () => {
    const malformed = "{".repeat(20_000);
    const startedAt = performance.now();
    const result = await generateStructured(
      [provider([malformed, 'prefix {"label":"ok"} suffix'])],
      { prompt: "x", maxOutputTokens: 10 },
      validate
    );
    expect(result).toMatchObject({ ok: true, value: { label: "ok" } });
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
  it("falls back, rejects wrong schemas, and leaves failures typed", async () => {
    const result = await generateStructured(
      [provider(['{"wrong":true}', '{"wrong":true}']), provider(['{"label":"fallback"}'])],
      { prompt: "x", maxOutputTokens: 10 },
      validate
    );
    expect(result).toMatchObject({
      ok: true,
      value: { label: "fallback" },
      trace: { provider: "ollama" }
    });
    const failure = await generateStructured(
      [provider(["bad", "bad"])],
      { prompt: "x", maxOutputTokens: 10 },
      validate
    );
    expect(failure).toMatchObject({ ok: false, error: "structured-output-invalid" });
  });
});
