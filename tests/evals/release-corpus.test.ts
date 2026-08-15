import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createReleaseDecisionValidator,
  validateReleaseCorpus,
  validateReleaseProviderReport
} from "../../evals/release/contracts.js";
import { fingerprintReleaseCorpus, loadReleaseCorpus } from "../../evals/release/load.js";

const root = resolve(import.meta.dirname, "../..");

describe("Northstar release corpus", () => {
  it("loads at least twenty realistic cases with positives, hard negatives, and abstentions", async () => {
    const loaded = await loadReleaseCorpus(root);

    expect(loaded.corpus.cases.length).toBeGreaterThanOrEqual(20);
    expect(new Set(loaded.corpus.cases.map((item) => item.id)).size).toBe(
      loaded.corpus.cases.length
    );
    expect(new Set(loaded.corpus.cases.map((item) => item.label))).toEqual(
      new Set(["positive", "hard-negative", "abstention"])
    );
    expect(loaded.corpus.cases.some((item) => item.expected.repairEligibility === "eligible")).toBe(
      true
    );
    expect(loaded.cases.every((item) => item.evidence.every((evidence) => evidence.excerpt))).toBe(
      true
    );
    expect(loaded.files.length).toBeGreaterThanOrEqual(10);
    expect(loaded.files.every((file) => file.path.endsWith(".md") && file.content.length > 0)).toBe(
      true
    );
    expect(fingerprintReleaseCorpus(loaded)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("validates the committed JSON and rejects duplicate IDs or unsafe fixture roots", async () => {
    const value = JSON.parse(
      await readFile(resolve(root, "evals/release/northstar-v1.json"), "utf8")
    ) as Record<string, unknown>;
    expect(validateReleaseCorpus(value)).toBe(true);
    expect(validateReleaseCorpus({ ...value, fixtureRoot: "../private" })).toBe(false);
    const cases = value.cases as Array<Record<string, unknown>>;
    expect(validateReleaseCorpus({ ...value, cases: [...cases, cases[0]] })).toBe(false);
  });

  it("allows only bounded evidence and candidate IDs in model decisions", async () => {
    const loaded = await loadReleaseCorpus(root);
    const repair = loaded.corpus.cases.find(
      (item) => item.expected.repairEligibility === "eligible"
    );
    if (!repair) throw new Error("Expected a repair case.");
    const validate = createReleaseDecisionValidator(repair);

    const decision = {
      decision: "finding",
      citedEvidenceIds: repair.expected.citedEvidenceIds,
      repairEligibility: repair.expected.repairEligibility,
      candidateTargetId: repair.expected.candidateTargetId
    };
    expect(validate(decision)).toBe(true);
    expect(validate({ ...decision, citedEvidenceIds: ["unknown"] })).toBe(false);
    expect(validate({ ...decision, candidateTargetId: "unknown" })).toBe(false);
    expect(validate({ ...decision, extra: "field" })).toBe(false);
    expect(
      validate({
        decision: "abstain",
        citedEvidenceIds: [],
        repairEligibility: "abstain",
        candidateTargetId: null
      })
    ).toBe(true);
  });

  it("rejects content-bearing or malformed provider reports", async () => {
    const loaded = await loadReleaseCorpus(root);
    const base = {
      schemaVersion: 1,
      reportId: "northstar-ollama-a1",
      createdAt: "2026-07-29T00:00:00.000Z",
      corpusId: loaded.corpus.id,
      corpusFingerprint: fingerprintReleaseCorpus(loaded),
      provider: "ollama",
      model: "qwen3:8b",
      status: "passed",
      thresholds: {
        precision: 0.9,
        recall: 0.85,
        f1: 0.87,
        evidenceValidity: 1,
        unsupportedFindingRate: 0.05,
        safeRepairValidity: 1,
        incompleteScans: 0,
        unsafeRemediations: 0
      },
      metrics: {
        precision: 1,
        recall: 1,
        f1: 1,
        evidenceValidity: 1,
        unsupportedFindingRate: 0,
        safeRepairValidity: 1,
        medianLatencyMs: 2,
        p95LatencyMs: 4,
        retries: 0,
        incompleteCases: 0,
        incompleteScans: 0,
        unsafeRemediations: 0
      },
      execution: {
        scanDurationMs: 10,
        modelInvocations: 2,
        deterministicFindingCount: 11,
        semanticFindingCount: 0,
        repairRecommendations: 1
      },
      cases: [
        {
          id: "project-owner-missing",
          outcome: "passed",
          durationMs: 2,
          retries: 0,
          errorCode: null
        }
      ]
    };
    expect(validateReleaseProviderReport(base)).toBe(true);
    expect(validateReleaseProviderReport({ ...base, model: "api key" })).toBe(false);
    expect(
      validateReleaseProviderReport({
        ...base,
        cases: [{ ...base.cases[0], errorCode: "raw output" }]
      })
    ).toBe(false);
  });
});
