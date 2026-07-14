import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createGovernedIntegritySession } from "../src/plugin/main.js";
import type { LocalProvider } from "../src/model-provider/local-provider.js";
import {
  evaluateOperationalBaseline,
  summarizeOperationalMetrics,
  type OperationalBaseline
} from "../src/observability/operational.js";

const root = resolve(import.meta.dirname, "..");
const baseline = JSON.parse(
  await readFile(resolve(root, "evals/baselines/operational.json"), "utf8")
) as OperationalBaseline;
const provider: LocalProvider = {
  config: {
    kind: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "baseline",
    timeoutMs: 1000,
    maxResponseBytes: 1000
  },
  capabilities: ["structured-output"],
  generate: async () => ({
    text: '{"candidates":[]}',
    provider: "ollama",
    model: "baseline",
    latencyMs: 1
  })
};
const started = performance.now();
const result = await createGovernedIntegritySession([provider]).scan([
  { path: "Home.md", content: "[[Missing]]" }
]);
const metrics = summarizeOperationalMetrics([
  {
    scanDurationMs: performance.now() - started,
    parseErrors: 0,
    modelLatencyMs: 1,
    tokenUsage: 0,
    toolCalls: result.semanticAnalysis.toolCalls,
    retries: 0,
    incomplete: !result.semanticAnalysis.completed,
    findingVolume: result.findings.length,
    staleProposals: 0,
    applyAttempts: 0,
    applyFailures: 0
  }
]);
const errors = evaluateOperationalBaseline(baseline, metrics);
await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  resolve(root, "evals/reports/operational.json"),
  `${JSON.stringify({ suite: "operational", baseline, metrics, errors }, null, 2)}\n`
);
if (errors.length) throw new Error(`Operational baseline failed: ${errors.join("; ")}`);
console.log(JSON.stringify({ suite: "operational", ...metrics }));
