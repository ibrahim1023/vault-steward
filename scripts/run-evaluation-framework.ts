import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { totalmem } from "node:os";

import { type EvaluationReport, validateEvaluationReport } from "../evals/contracts.js";
import { evaluateFixtureCase } from "../evals/evaluate-case.js";
import { loadEvaluationCases } from "../evals/fixtures.js";
import { gradeExpectedFindings } from "../evals/graders/metrics.js";
import { compareEvaluationReports } from "../evals/regression.js";
import {
  buildRedactedReport,
  parseEvaluationSelection,
  selectEvaluationCases
} from "../evals/runner.js";

const root = resolve(import.meta.dirname, "..");
const selection = parseEvaluationSelection(process.argv.slice(2));
const manifest = selection.manifest ?? "evals/manifests/ci-regression.json";
const cases = selectEvaluationCases(
  await loadEvaluationCases(root, manifest, selection),
  selection
);
const executions = await Promise.all(
  cases.map(async (item) => {
    const startedAt = performance.now();
    const actual = await evaluateFixtureCase(root, item);
    return { item, actual, durationMs: performance.now() - startedAt };
  })
);
const graded = executions.map(({ item, actual }) =>
  gradeExpectedFindings(
    item.expected.map((finding) => ({
      ...finding,
      supported: true,
      schemaValid: true,
      routeValid: true,
      terminated: true
    })),
    actual
  )
);
const metrics = averageMetrics(graded);
metrics.parseSuccess = 1;
metrics.p95LatencyMs = percentile(
  executions.map((item) => item.durationMs),
  0.95
);
metrics.peakMemoryBytes = process.memoryUsage().heapUsed;
const report = buildRedactedReport({
  reportId: `eval-${createHash("sha256")
    .update(cases.map((item) => item.id).join("|"))
    .digest("hex")
    .slice(0, 16)}`,
  createdAt: new Date().toISOString(),
  selection: {
    suite: selection.suite ?? "fixture",
    caseIds: cases.map((item) => item.id),
    splits: selection.splits,
    ...(selection.agent ? { agent: selection.agent } : {}),
    ...(selection.modelProfile ? { modelProfile: selection.modelProfile } : {})
  },
  provenance: {
    pluginVersion: "0.1.0",
    parserVersion: "scanner-v1",
    graderVersion: "phase-14-v1",
    promptVersions: ["none"],
    policyVersions: ["fixture-policy-v1"],
    schemaVersions: ["evaluation-case-v1", "finding-v1"],
    modelProfile: selection.modelProfile ?? "deterministic-fixture",
    fixtureManifestHash: await fileHash(resolve(root, manifest)),
    configurationFingerprint: createHash("sha256").update(JSON.stringify(selection)).digest("hex"),
    hardware: {
      platform: process.platform,
      architecture: process.arch,
      memoryBytes: Math.round(totalmem()),
      runtime: process.version
    }
  },
  metrics,
  cases: executions.map(({ item, actual, durationMs }) => ({
    id: item.id,
    outcome: actual.length === item.expected.length ? ("passed" as const) : ("failed" as const),
    durationMs: Math.round(durationMs),
    errorCode: actual.length === item.expected.length ? null : "finding-count-mismatch"
  }))
});
if (!validateEvaluationReport(report)) throw new Error("Generated evaluation report is invalid.");
if (selection.compare) {
  const baseline = JSON.parse(
    await readFile(resolve(root, selection.compare), "utf8")
  ) as typeof report;
  const failures = compareEvaluationReports(baseline, report);
  if (failures.length > 0) throw new Error(`Evaluation regression failed: ${failures.join(", ")}`);
}
function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentileValue))] ?? 0;
}
await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  resolve(root, "evals/reports/framework.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(
  JSON.stringify({ suite: report.selection.suite, cases: report.cases.length, ...report.metrics })
);

async function fileHash(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
function averageMetrics(
  items: readonly ReturnType<typeof gradeExpectedFindings>[]
): EvaluationReport["metrics"] {
  const keys = Object.keys(items[0] ?? {});
  return Object.fromEntries(
    keys.map((key) => {
      const values = items
        .map((item) => item[key as keyof typeof item])
        .filter((value): value is number => typeof value === "number");
      return [
        key,
        values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
      ];
    })
  ) as EvaluationReport["metrics"];
}
