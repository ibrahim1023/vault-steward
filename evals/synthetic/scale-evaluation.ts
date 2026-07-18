import { checkReferenceIntegrity } from "../../src/reference/check.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";
import type { GeneratedSyntheticVault, SyntheticDefectKind } from "./contracts.js";

export type SyntheticScaleReport = {
  schemaVersion: 1;
  configurationHash: string;
  generatedFileCount: number;
  evaluatedFamilies: ["reference"];
  achievedDefectCounts: Record<SyntheticDefectKind, number>;
  metrics: { precision: number; recall: number; f1: number };
};

export function assertSyntheticScaleBaseline(
  report: SyntheticScaleReport,
  baseline: SyntheticScaleReport
): void {
  if (report.configurationHash !== baseline.configurationHash) {
    throw new Error("Synthetic scale baseline configuration mismatch.");
  }
  if (report.generatedFileCount !== baseline.generatedFileCount) {
    throw new Error("Synthetic scale generated-file count mismatch.");
  }
  for (const metric of ["precision", "recall", "f1"] as const) {
    if (report.metrics[metric] < baseline.metrics[metric]) {
      throw new Error(`Synthetic ${metric} regression.`);
    }
  }
}

export function evaluateSyntheticScale(generated: GeneratedSyntheticVault): SyntheticScaleReport {
  const expected = new Set(
    generated.groundTruth.defects
      .filter((defect) => defect.kind === "broken-reference")
      .map((defect) => `${defect.notePath}:${defect.locator}`)
  );
  const actual = new Set(
    checkReferenceIntegrity(scanVaultFiles(generated.files))
      .filter((finding) => finding.type === "broken-reference")
      .map((finding) => {
        const evidence = finding.evidence[0];
        return evidence ? `${evidence.notePath}:${evidence.locator}` : "";
      })
      .filter(Boolean)
  );
  const truePositives = [...actual].filter((item) => expected.has(item)).length;
  const precision = actual.size === 0 ? (expected.size === 0 ? 1 : 0) : truePositives / actual.size;
  const recall = expected.size === 0 ? 1 : truePositives / expected.size;
  return {
    schemaVersion: 1,
    configurationHash: generated.groundTruth.configurationHash,
    generatedFileCount: generated.files.length,
    evaluatedFamilies: ["reference"],
    achievedDefectCounts: generated.achievedDefectCounts,
    metrics: {
      precision,
      recall,
      f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
    }
  };
}
