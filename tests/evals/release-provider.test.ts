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
  it("grades the actual governed scan and bounded repair path without persisting content", async () => {
    const loaded = await loadReleaseCorpus(root);
    const provider = governedProvider();
    const report = await evaluateReleaseProvider({
      ...loaded,
      provider,
      corpusFingerprint: fingerprintReleaseCorpus(loaded),
      now: () => new Date("2026-07-29T00:00:00.000Z")
    });

    expect(report.status, JSON.stringify(report, null, 2)).toBe("passed");
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
    expect(report.execution).toMatchObject({
      deterministicFindingCount: 14,
      semanticFindingCount: 0,
      repairRecommendations: 1
    });
    expect(JSON.stringify(report)).not.toMatch(
      /workspace configuration|permission-template|api key|raw output/i
    );
  });

  it("does not let model output invent deterministic findings", async () => {
    const loaded = await loadReleaseCorpus(root);
    const provider = governedProvider({
      agentOutput: {
        candidates: [
          {
            type: "task",
            severity: "critical",
            evidence: [],
            explanation: "Invented deterministic finding."
          }
        ]
      }
    });
    const report = await evaluateReleaseProvider({
      ...loaded,
      provider,
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });

    expect(report.status).toBe("passed");
    expect(report.metrics.unsupportedFindingRate).toBe(0);
    expect(report.execution.semanticFindingCount).toBe(0);
  });

  it("fails the release when bounded repair selection abstains", async () => {
    const loaded = await loadReleaseCorpus(root);
    const report = await evaluateReleaseProvider({
      ...loaded,
      provider: governedProvider({ repairCandidateId: null }),
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });

    expect(report.status).toBe("failed");
    expect(report.metrics.safeRepairValidity).toBe(0);
    expect(report.metrics.unsafeRemediations).toBe(0);
  });

  it("fails when any labelled case disagrees even if aggregate thresholds pass", async () => {
    const loaded = await loadReleaseCorpus(root);
    const cases = loaded.cases.map((item) =>
      item.item.id === "project-owner-missing"
        ? {
            ...item,
            item: {
              ...item.item,
              expected: { ...item.item.expected, severity: "critical" as const }
            }
          }
        : item
    );
    const report = await evaluateReleaseProvider({
      ...loaded,
      cases,
      provider: governedProvider(),
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });

    expect(report.metrics.precision).toBe(1);
    expect(report.status).toBe("failed");
    expect(report.cases.find((item) => item.id === "project-owner-missing")?.outcome).toBe(
      "failed"
    );
  });

  it("marks provider failures incomplete and requires both passing provider reports", async () => {
    const loaded = await loadReleaseCorpus(root);
    const failedProvider = governedProvider({ fail: true });
    const incomplete = await evaluateReleaseProvider({
      ...loaded,
      provider: failedProvider,
      corpusFingerprint: fingerprintReleaseCorpus(loaded)
    });
    expect(incomplete.status).toBe("incomplete");
    expect(incomplete.metrics.incompleteScans).toBe(1);

    const ollama = await evaluateReleaseProvider({
      ...loaded,
      provider: governedProvider(),
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

function governedProvider(
  options: {
    fail?: boolean;
    agentOutput?: unknown;
    repairCandidateId?: string | null;
  } = {}
): ModelProvider {
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
      if (options.fail) throw new Error("provider unavailable");
      if (request.prompt.includes('"task":"select-reference-repair"')) {
        const parsed = JSON.parse(request.prompt) as {
          request: { candidates: Array<{ id: string; path: string }> };
        };
        const selected =
          options.repairCandidateId === undefined
            ? (parsed.request.candidates.find(
                (candidate) => candidate.path === "Guides/Partner Onboarding Checklist.md"
              )?.id ?? null)
            : options.repairCandidateId;
        return {
          text: JSON.stringify({
            schemaVersion: 1,
            candidateId: selected,
            reason: selected ? "The candidate is the intended checklist." : "No supported match."
          }),
          model: "release-test-model",
          provider: "ollama",
          latencyMs: 1
        };
      }
      return {
        text: JSON.stringify(options.agentOutput ?? { candidates: [] }),
        model: "release-test-model",
        provider: "ollama",
        latencyMs: 1
      };
    }
  };
}
