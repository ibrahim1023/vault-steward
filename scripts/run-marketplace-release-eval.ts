import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createLocalProvider,
  createHyperFusionProvider,
  createOpenAIProvider,
  HYPERFUSION_API_BASE_URL,
  OPENAI_API_BASE_URL,
  type ModelProvider
} from "../src/model-provider/local-provider.js";
import { validateReleaseProviderReport } from "../evals/release/contracts.js";
import { evaluateReleaseProvider } from "../evals/release/evaluate.js";
import { fingerprintReleaseCorpus, loadReleaseCorpus } from "../evals/release/load.js";

const root = resolve(import.meta.dirname, "..");
const providerKind = parseProvider(process.argv.slice(2));
const provider = createConfiguredProvider(providerKind);
const loaded = await loadReleaseCorpus(root);
const report = await evaluateReleaseProvider({
  ...loaded,
  provider,
  corpusFingerprint: fingerprintReleaseCorpus(loaded)
});
if (!validateReleaseProviderReport(report))
  throw new Error("Generated marketplace release report is invalid.");

const reportDirectory = resolve(root, "evals", "reports");
await mkdir(reportDirectory, { recursive: true });
await writeFile(
  resolve(reportDirectory, `northstar-${providerKind}.json`),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(
  JSON.stringify({
    provider: report.provider,
    model: report.model,
    status: report.status,
    cases: report.cases.length,
    ...report.metrics
  })
);
if (report.status !== "passed") process.exitCode = 1;

function parseProvider(args: readonly string[]): "ollama" | "openai" | "hyperfusion" {
  if (args.length !== 2 || args[0] !== "--provider")
    throw new Error("Use --provider ollama, hyperfusion, or openai.");
  if (args[1] !== "ollama" && args[1] !== "hyperfusion" && args[1] !== "openai")
    throw new Error("Unknown marketplace evaluation provider.");
  return args[1];
}

function createConfiguredProvider(kind: "ollama" | "openai" | "hyperfusion"): ModelProvider {
  if (kind === "ollama") {
    const model = requireEnvironment("OLLAMA_MODEL");
    return createLocalProvider({
      kind: "ollama",
      endpoint: "http://127.0.0.1:11434",
      model,
      timeoutMs: 60_000,
      maxResponseBytes: 32_768
    });
  }
  if (kind === "hyperfusion") {
    if (process.env.HYPERFUSION_CLOUD_ACKNOWLEDGED !== "true")
      throw new Error("HyperFusion release evaluation requires explicit cloud acknowledgement.");
    return createHyperFusionProvider({
      kind: "hyperfusion",
      endpoint: HYPERFUSION_API_BASE_URL,
      model: requireEnvironment("HYPERFUSION_MODEL"),
      apiKey: requireEnvironment("HYPERFUSION_API_KEY"),
      timeoutMs: 60_000,
      maxResponseBytes: 32_768
    });
  }
  if (process.env.OPENAI_CLOUD_ACKNOWLEDGED !== "true")
    throw new Error("OpenAI release evaluation requires explicit cloud acknowledgement.");
  return createOpenAIProvider({
    kind: "openai",
    endpoint: OPENAI_API_BASE_URL,
    model: requireEnvironment("OPENAI_MODEL"),
    apiKey: requireEnvironment("OPENAI_API_KEY"),
    timeoutMs: 60_000,
    maxResponseBytes: 32_768
  });
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required ${name}.`);
  return value;
}
