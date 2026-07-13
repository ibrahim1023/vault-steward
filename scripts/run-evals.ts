import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  gradeReferenceIntegrity,
  type ExpectedReferenceFinding
} from "../evals/graders/reference-integrity.js";
import { checkReferenceIntegrity } from "../src/reference/check.js";
import { scanVaultFiles } from "../src/scanner/scan.js";
import type { VaultFile } from "../src/vault-adapter/types.js";

type DatasetCase = {
  id: string;
  files: VaultFile[];
  expected: ExpectedReferenceFinding[];
};

const root = resolve(import.meta.dirname, "..");
const datasetPath = resolve(root, "evals/datasets/reference-integrity.jsonl");
const reportPath = resolve(root, "evals/reports/reference-integrity.json");
const args = new Set(process.argv.slice(2));

if (!args.has("--suite") && !args.has("--all")) {
  throw new Error("Expected --suite reference-integrity or --all.");
}

const cases = await loadCases();
const results = cases.map((testCase) => {
  const findings = checkReferenceIntegrity(scanVaultFiles(testCase.files));
  return {
    id: testCase.id,
    actual: findings.map((finding) => ({
      type: finding.type,
      notePath: finding.evidence[0]?.notePath ?? "",
      locator: finding.evidence[0]?.locator ?? ""
    }))
  };
});
const report = gradeReferenceIntegrity(cases, results);

await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  reportPath,
  `${JSON.stringify({ suite: "reference-integrity", ...report }, null, 2)}\n`
);

if (report.evidenceValidity !== 1 || report.precision !== 1 || report.recall !== 1) {
  throw new Error(`Reference-integrity evaluation failed: ${JSON.stringify(report)}`);
}

console.log(JSON.stringify({ suite: "reference-integrity", ...report }));

async function loadCases(): Promise<DatasetCase[]> {
  const content = await readFile(datasetPath, "utf8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DatasetCase);
}
