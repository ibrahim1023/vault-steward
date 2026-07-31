import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { type EvaluationReport, validateEvaluationReport } from "../evals/contracts.js";
import {
  type ReleaseProviderReport,
  validateReleaseProviderReport
} from "../evals/release/contracts.js";
import { buildReleaseQualityReport } from "../evals/release/quality-report.js";

const root = resolve(import.meta.dirname, "..");
const evaluation = await readValid<EvaluationReport>(
  "evals/reports/framework.json",
  validateEvaluationReport
);
const providerReports = (
  await Promise.all([
    readValid<ReleaseProviderReport>(
      "evals/reports/northstar-ollama.json",
      validateReleaseProviderReport
    ),
    readValid<ReleaseProviderReport>(
      "evals/reports/northstar-hyperfusion.json",
      validateReleaseProviderReport
    ),
    readValid<ReleaseProviderReport>(
      "evals/reports/northstar-openai.json",
      validateReleaseProviderReport
    )
  ])
).flatMap((report) => (report ? [report] : []));
const report = buildReleaseQualityReport({
  generatedAt: new Date().toISOString(),
  ...(evaluation ? { evaluation } : {}),
  providerReports,
  manualAcceptance: process.argv.includes("--manual-acceptance")
});
await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  resolve(root, "evals/reports/release-quality.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify({ decision: report.decision, gates: report.gates }));

async function readValid<T>(
  relativePath: string,
  validate: (value: unknown) => value is T
): Promise<T | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
    return validate(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
