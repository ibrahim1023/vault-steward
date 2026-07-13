import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  gradeReferenceIntegrity,
  type ExpectedReferenceFinding
} from "../evals/graders/reference-integrity.js";
import {
  gradeModelAssistedDataset,
  type ModelAssistedCase
} from "../evals/graders/model-assisted.js";
import { checkReferenceIntegrity } from "../src/reference/check.js";
import { scanVaultFiles } from "../src/scanner/scan.js";
import type { VaultFile } from "../src/vault-adapter/types.js";

type DatasetCase = {
  id: string;
  files: VaultFile[];
  expected: ExpectedReferenceFinding[];
};

const root = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));

if (!args.has("--suite") && !args.has("--all")) {
  throw new Error("Expected --suite reference-integrity or --all.");
}

if (args.has("--suite") && !args.has("reference-integrity") && !args.has("model-assisted")) {
  throw new Error("Unknown evaluation suite.");
}

if (args.has("--all") || args.has("reference-integrity")) await runReferenceIntegrity();
if (args.has("--all") || args.has("model-assisted")) await runModelAssistedDataset();

async function runReferenceIntegrity(): Promise<void> {
  const cases = await loadCases(resolve(root, "evals/datasets/reference-integrity.jsonl"));
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

  await writeReport("reference-integrity", report);

  if (report.evidenceValidity !== 1 || report.precision !== 1 || report.recall !== 1) {
    throw new Error(`Reference-integrity evaluation failed: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({ suite: "reference-integrity", ...report }));
}

async function runModelAssistedDataset(): Promise<void> {
  const cases = await loadCases<ModelAssistedCase>(
    resolve(root, "evals/datasets/model-assisted.jsonl")
  );
  const report = gradeModelAssistedDataset(cases);
  await writeReport("model-assisted", report);
  if (report.evidenceValidity !== 1 || report.coverage !== 1) {
    throw new Error(`Model-assisted dataset evaluation failed: ${JSON.stringify(report)}`);
  }
  console.log(JSON.stringify({ suite: "model-assisted", ...report }));
}

async function writeReport(suite: string, report: object): Promise<void> {
  await mkdir(resolve(root, "evals/reports"), { recursive: true });
  await writeFile(
    resolve(root, `evals/reports/${suite}.json`),
    `${JSON.stringify({ suite, ...report }, null, 2)}\n`
  );
}

async function loadCases<T = DatasetCase>(datasetPath: string): Promise<T[]> {
  const content = await readFile(datasetPath, "utf8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
