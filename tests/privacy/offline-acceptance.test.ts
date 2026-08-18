import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createHyperFusionProvider,
  createLocalProvider,
  createOpenAIProvider,
  HYPERFUSION_API_BASE_URL,
  OPENAI_API_BASE_URL
} from "../../src/model-provider/local-provider.js";

const sourceRoot = resolve(import.meta.dirname, "../../src");

describe("offline and privacy acceptance", () => {
  it("keeps runtime source free of shell, telemetry, cloud storage, and arbitrary remote endpoints", async () => {
    const sources = await readSources(sourceRoot);
    const combined = sources.map((source) => source.content).join("\n");

    expect(combined).not.toMatch(/node:child_process|execFile\(|spawn\(|shelljs/i);
    expect(combined).not.toMatch(/telemetry\.(track|capture)|analytics\.(track|capture)/i);
    expect(combined).not.toMatch(/from\s+["'](?:@sentry|aws-sdk|firebase|supabase|lancedb)/i);
    expect(combined).toContain('import { requestUrl } from "obsidian"');
    expect(combined).not.toMatch(/\bfetch\s*\(/);
  });

  it("rejects cloud and private-network local endpoints and pins cloud providers to their API origins", () => {
    for (const endpoint of [
      "https://api.example.com",
      "http://10.0.0.1:11434",
      "http://192.168.1.2:11434"
    ]) {
      expect(() =>
        createLocalProvider({
          kind: "ollama",
          endpoint,
          model: "local",
          timeoutMs: 100,
          maxResponseBytes: 1000
        })
      ).toThrow("loopback");
    }
    expect(() =>
      createOpenAIProvider({
        kind: "openai",
        endpoint: "https://example.com/v1" as typeof OPENAI_API_BASE_URL,
        model: "gpt-4o-mini",
        apiKey: "sk-test",
        timeoutMs: 100,
        maxResponseBytes: 1000
      })
    ).toThrow("configuration");
    expect(() =>
      createHyperFusionProvider({
        kind: "hyperfusion",
        endpoint: "https://example.com/v1" as typeof HYPERFUSION_API_BASE_URL,
        model: "qwen/qwen3-32b",
        apiKey: "hf-test",
        timeoutMs: 100,
        maxResponseBytes: 1000
      })
    ).toThrow("configuration");
  });
});

async function readSources(
  directory: string,
  prefix = ""
): Promise<Array<{ path: string; content: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relative = `${prefix}${entry.name}`;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return readSources(path, `${relative}/`);
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) return [];
      return [{ path: relative, content: await readFile(path, "utf8") }];
    })
  );
  return nested.flat();
}
