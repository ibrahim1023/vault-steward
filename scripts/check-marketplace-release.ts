import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  type ReleaseProviderReport,
  validateReleaseProviderReport
} from "../evals/release/contracts.js";
import { assertReleaseReports } from "../evals/release/evaluate.js";
import { fingerprintReleaseCorpus, loadReleaseCorpus } from "../evals/release/load.js";

const root = resolve(import.meta.dirname, "..");
const loaded = await loadReleaseCorpus(root);
const reports = await Promise.all(["ollama", "openai"].map((provider) => loadReport(provider)));
assertReleaseReports(reports, fingerprintReleaseCorpus(loaded));
console.log(
  JSON.stringify({
    status: "passed",
    corpus: loaded.corpus.id,
    cases: loaded.corpus.cases.length,
    providers: reports.map((report) => ({
      provider: report.provider,
      model: report.model,
      status: report.status
    }))
  })
);

async function loadReport(provider: string): Promise<ReleaseProviderReport> {
  const value = JSON.parse(
    await readFile(resolve(root, "evals", "reports", `northstar-${provider}.json`), "utf8")
  ) as unknown;
  if (!validateReleaseProviderReport(value))
    throw new Error(`${provider} release report is invalid.`);
  return value;
}
