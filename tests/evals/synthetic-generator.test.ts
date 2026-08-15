import { describe, expect, it } from "vitest";

import { generateSyntheticVault } from "../../evals/synthetic/generate.js";
import { checkReferenceIntegrity } from "../../src/reference/check.js";
import { scanVaultFiles } from "../../src/scanner/scan.js";

const config = {
  seed: "phase16-fixture",
  noteCount: 8,
  folderDepth: 2,
  linkDensity: 0.5,
  entityCount: 3,
  taskCount: 3,
  decisionCount: 2,
  contradictionRate: 1,
  duplicateEntityRate: 1,
  brokenReferenceRate: 1,
  stalenessRate: 1,
  orphanTaskRate: 1,
  schemaViolationRate: 1,
  unresolvedDecisionRate: 1
} as const;

describe("seeded synthetic vault generation", () => {
  it("is deterministic and records only achieved redacted ground truth", () => {
    const first = generateSyntheticVault(config);
    const second = generateSyntheticVault(config);

    expect(first).toEqual(second);
    expect(first.files).toHaveLength(8);
    expect(first.groundTruth.defects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "broken-reference" }),
        expect.objectContaining({ kind: "contradiction" }),
        expect.objectContaining({ kind: "duplicate-entity" }),
        expect.objectContaining({ kind: "stale-note" }),
        expect.objectContaining({ kind: "orphan-task" }),
        expect.objectContaining({ kind: "schema-violation" }),
        expect.objectContaining({ kind: "unresolved-decision" })
      ])
    );
    expect(JSON.stringify(first.groundTruth)).not.toMatch(/\/Users\/|https?:\/\/|note body/i);
    expect(first.groundTruth.defects.every((item) => /^Synthetic\//.test(item.notePath))).toBe(
      true
    );
  });

  it("varies output by seed while preserving safe relative paths", () => {
    const first = generateSyntheticVault(config);
    const second = generateSyntheticVault({ ...config, seed: "another-seed" });

    expect(first.groundTruth.configurationHash).not.toBe(second.groundTruth.configurationHash);
    expect(first.files.map((file) => file.path)).not.toEqual(second.files.map((file) => file.path));
    expect(
      second.files.every((file) => !file.path.includes("..") && !file.path.startsWith("/"))
    ).toBe(true);
  });

  it("fails closed for invalid bounded configuration", () => {
    expect(() => generateSyntheticVault({ ...config, noteCount: 0 })).toThrow("noteCount");
    expect(() => generateSyntheticVault({ ...config, brokenReferenceRate: 1.1 })).toThrow(
      "brokenReferenceRate"
    );
    expect(() => generateSyntheticVault({ ...config, seed: "unsafe\nseed" })).toThrow("seed");
    expect(() => generateSyntheticVault({ ...config, taskCount: config.noteCount + 1 })).toThrow(
      "taskCount"
    );
  });

  it("creates valid base references before it injects broken references", () => {
    const generated = generateSyntheticVault({
      ...config,
      linkDensity: 1,
      brokenReferenceRate: 0
    });

    expect(checkReferenceIntegrity(scanVaultFiles(generated.files))).toEqual([]);
  });
});
