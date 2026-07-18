import { describe, expect, it } from "vitest";

import { evaluateRetrievalQuality } from "../../evals/retrieval/evaluate.js";

describe("retrieval quality evaluation", () => {
  it("summarizes safe ranked retrieval metadata", () => {
    const report = evaluateRetrievalQuality(
      [
        {
          queryId: "q1",
          requestedK: 2,
          candidates: [
            { evidenceId: "e1", score: 0.9 },
            { evidenceId: "e2", score: 0.2 }
          ],
          cache: "hit",
          durationMs: 5
        },
        {
          queryId: "q2",
          requestedK: 1,
          candidates: [{ evidenceId: "e3", score: 0.7 }],
          cache: "miss",
          durationMs: 9
        }
      ],
      [
        { queryId: "q1", relevantEvidenceIds: ["e1"] },
        { queryId: "q2", relevantEvidenceIds: ["e3"] }
      ]
    );

    expect(report).toEqual(
      expect.objectContaining({
        status: "measured",
        coverage: 1,
        relevanceRate: 2 / 3,
        cacheHitRate: 0.5,
        score: { min: 0.2, max: 0.9, mean: 0.6 },
        p50LatencyMs: 5,
        p95LatencyMs: 9,
        missingQueryCount: 0
      })
    );
  });

  it("reports an absent optional adapter without quality claims", () => {
    expect(evaluateRetrievalQuality([], [])).toEqual({
      schemaVersion: 1,
      status: "not-configured",
      coverage: null,
      relevanceRate: null,
      cacheHitRate: null,
      score: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      missingQueryCount: 0
    });
  });

  it("rejects unsafe or inconsistent metadata", () => {
    expect(() =>
      evaluateRetrievalQuality(
        [
          {
            queryId: "q1",
            requestedK: 1,
            candidates: [{ evidenceId: "e1", score: Number.NaN }],
            cache: "hit",
            durationMs: 1
          }
        ],
        [{ queryId: "q1", relevantEvidenceIds: ["e1"] }]
      )
    ).toThrow("finite");
    expect(() =>
      evaluateRetrievalQuality([], [{ queryId: "q1", relevantEvidenceIds: ["e1"] }])
    ).toThrow("events");
  });
});
