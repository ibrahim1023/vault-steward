import { describe, expect, it } from "vitest";
import { generateStructured } from "../../src/model-provider/structured.js";
import type { LocalProvider } from "../../src/model-provider/local-provider.js";

const provider = (responses: string[]): LocalProvider => ({
  config: {
    kind: "ollama",
    endpoint: "http://localhost:1",
    model: "test",
    timeoutMs: 1,
    maxResponseBytes: 1000
  },
  capabilities: ["structured-output"],
  generate: async () => ({
    text: responses.shift() ?? "",
    model: "test",
    provider: "ollama",
    latencyMs: 2
  })
});
const validate = (value: unknown): value is { label: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { label?: unknown }).label === "string";

describe("structured local output", () => {
  it("repairs malformed output once and records only redacted trace metadata", async () => {
    const result = await generateStructured(
      [provider(["not json", '{"label":"ok"}'])],
      { prompt: "secret note content", maxOutputTokens: 10 },
      validate
    );
    expect(result).toMatchObject({
      ok: true,
      value: { label: "ok" },
      trace: { retries: 1, provider: "ollama" }
    });
    expect(JSON.stringify(result.trace)).not.toContain("secret");
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
