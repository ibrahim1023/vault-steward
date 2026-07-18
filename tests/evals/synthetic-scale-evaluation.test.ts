import { describe, expect, it } from "vitest";

import { generateSyntheticVault } from "../../evals/synthetic/generate.js";
import { evaluateSyntheticScale } from "../../evals/synthetic/scale-evaluation.js";

describe("synthetic scale evaluation", () => {
  it("grades deterministic reference findings against generated ground truth", () => {
    const generated = generateSyntheticVault({
      seed: "synthetic-scale",
      noteCount: 8,
      folderDepth: 2,
      linkDensity: 1,
      entityCount: 2,
      taskCount: 0,
      decisionCount: 0,
      contradictionRate: 0,
      duplicateEntityRate: 0,
      brokenReferenceRate: 1,
      stalenessRate: 0,
      orphanTaskRate: 0,
      schemaViolationRate: 0,
      unresolvedDecisionRate: 0
    });

    const report = evaluateSyntheticScale(generated);

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedFileCount: 8,
      evaluatedFamilies: ["reference"],
      achievedDefectCounts: { "broken-reference": 8 },
      metrics: { precision: 1, recall: 1, f1: 1 }
    });
    expect(JSON.stringify(report)).not.toMatch(/\/Users\/|https?:\/\/|note body/i);
  });
});
