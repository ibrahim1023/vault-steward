import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  LocalGenerationRequest,
  ModelProvider
} from "../../src/model-provider/local-provider.js";
import { assertReleaseReports, evaluateReleaseProvider } from "../../evals/release/evaluate.js";
import { fingerprintReleaseCorpus, loadReleaseCorpus } from "../../evals/release/load.js";

const root = resolve(import.meta.dirname, "../..");

describe("marketplace provider evaluation", () => {
  it("grades the same labelled corpus without persisting evidence or secrets", async () => {
    const loaded = await loadReleaseCorpus(root);
    const provider = providerFor(decisionsFor(loaded.corpus.cases));
    const report = await evaluateReleaseProvider({
      ...loaded,
      provider,
      corpusFingerprint: fingerprintReleaseCorpus(loaded),
      now: () => new Date("2026-07-29T00:00:00.000Z")
    });

    expect(report.status).toBe("passed");
    expect(report.cases).toHaveLength(loaded.corpus.cases.length);
    expect(report.metrics).toMatchObject({
      precision: 1,
      recall: 1,
      f1: 1,
      evidenceValidity: 1,
      unsupportedFindingRate: 0,
      safeRepairValidity: 1,
      incompleteCases: 0,
      incompleteScans: 0,
      unsafeRemediations: 0
    });
    expect(JSON.stringify(report)).not.toMatch(
      /workspace configuration|permission-template|api key|raw output/i
    );
  });

  it("fails the release when a provider proposes an unsafe repair", async () => {
    const loaded = await loadReleaseCorpus(root);
    const decisions = decisionsFor(loaded.corpus.cases);
    decisions.set("brief-reference-valid", {
      decision: "finding",
      citedEvidenceIds: ["e1"],
      repairEligibility: "eligible",
      candidateTargetId: "target-1"
    });
    const report = await evaluateReleaseProvider({
      ...loaded,
      provider: providerFor(decisions),
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });

    expect(report.status).toBe("failed");
    expect(report.metrics.unsafeRemediations).toBe(1);
    expect(report.metrics.unsupportedFindingRate).toBeGreaterThan(0);
  });

  it("marks provider failures incomplete and requires both passing provider reports", async () => {
    const loaded = await loadReleaseCorpus(root);
    const failedProvider = providerFor(new Map(), true);
    const incomplete = await evaluateReleaseProvider({
      ...loaded,
      provider: failedProvider,
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });
    expect(incomplete.status).toBe("incomplete");
    expect(incomplete.metrics.incompleteScans).toBe(1);

    const decisions = decisionsFor(loaded.corpus.cases);
    const ollama = await evaluateReleaseProvider({
      ...loaded,
      provider: providerFor(decisions),
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });
    const openai = {
      ...ollama,
      reportId: "northstar-openai-a1",
      provider: "openai" as const,
      model: "openai-release-model"
    };
    expect(() =>
      assertReleaseReports([ollama, openai], fingerprintReleaseCorpus(loaded))
    ).not.toThrow();
    expect(() => assertReleaseReports([ollama], fingerprintReleaseCorpus(loaded))).toThrow(
      "Missing openai"
    );
    expect(() =>
      assertReleaseReports(
        [ollama, { ...openai, status: "failed" }],
        fingerprintReleaseCorpus(loaded)
      )
    ).toThrow("did not pass");
  });
});

function decisionsFor(
  cases: readonly {
    id: string;
    expected: {
      decision: string;
      citedEvidenceIds: string[];
      repairEligibility: string;
      candidateTargetId: string | null;
    };
  }[]
): Map<string, unknown> {
  return new Map(
    cases.map((item) => [
      item.id,
      {
        decision: item.expected.decision,
        citedEvidenceIds: item.expected.citedEvidenceIds,
        repairEligibility: item.expected.repairEligibility,
        candidateTargetId: item.expected.candidateTargetId
      }
    ])
  );
}

function providerFor(decisions: Map<string, unknown>, fail = false): ModelProvider {
  return {
    config: {
      kind: "ollama",
      endpoint: "http://127.0.0.1:11434",
      model: "release-test-model",
      timeoutMs: 1_000,
      maxResponseBytes: 4_096
    },
    capabilities: ["structured-output"],
    async generate(request: LocalGenerationRequest) {
      if (fail) throw new Error("provider unavailable");
      const id = /Case: ([a-z0-9-]+)/.exec(request.prompt)?.[1];
      const decision = id ? decisions.get(id) : undefined;
      if (!decision) throw new Error("missing test decision");
      return {
        text: JSON.stringify(decision),
        model: "release-test-model",
        provider: "ollama",
        latencyMs: 1
      };
    }
  };
}
