import { describe, expect, it } from "vitest";

import { calibrateConfidence } from "../../evals/replay/calibration.js";
import { calibrationSamplesFromHumanReviews } from "../../evals/human-review.js";

describe("confidence calibration", () => {
  it("warns about sufficiently supported overconfidence", () => {
    const report = calibrateConfidence(
      Array.from({ length: 5 }, () => ({
        agent: "entity",
        findingType: "alias",
        confidence: 0.9,
        correct: false,
        adjudicated: true
      }))
    );

    expect(report.buckets).toEqual([
      expect.objectContaining({
        agent: "entity",
        findingType: "alias",
        bucket: "0.8-1.0",
        support: 5,
        accuracy: 0,
        overconfidenceGap: 0.9,
        underconfidenceGap: 0,
        warning: true
      })
    ]);
  });

  it("excludes uncertain or unadjudicated labels", () => {
    const samples = calibrationSamplesFromHumanReviews([
      {
        caseId: "case-1",
        reviewerId: "reviewer-1",
        label: "uncertain",
        agent: "entity",
        findingType: "alias",
        confidence: 0.4,
        adjudicated: true
      },
      {
        caseId: "case-2",
        reviewerId: "reviewer-1",
        label: "correct",
        agent: "entity",
        findingType: "alias",
        confidence: 0.4,
        adjudicated: false
      }
    ]);

    expect(samples).toEqual([]);
    expect(calibrateConfidence(samples).buckets).toEqual([]);
  });

  it("reports underconfidence without a warning below the minimum support", () => {
    const report = calibrateConfidence([
      {
        agent: "decision",
        findingType: "missing-rationale",
        confidence: 0.3,
        correct: true,
        adjudicated: true
      }
    ]);

    expect(report.buckets).toEqual([
      expect.objectContaining({
        bucket: "0.2-0.4",
        accuracy: 1,
        overconfidenceGap: 0,
        underconfidenceGap: 0.7,
        warning: false
      })
    ]);
  });
});
