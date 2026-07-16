import { describe, expect, it } from "vitest";
import { gradeExpectedFindings } from "../../evals/graders/metrics.js";

const finding = {
  type: "task",
  notePath: "Tasks.md",
  locator: "line:1",
  severity: "medium",
  safeFix: "not-applicable" as const,
  supported: true,
  schemaValid: true,
  routeValid: true,
  terminated: true
};

describe("shared evaluation metrics", () => {
  it("grades evidence, source ranges, safety, and workflow compliance", () => {
    expect(gradeExpectedFindings([finding], [finding])).toMatchObject({
      precision: 1,
      recall: 1,
      sourceRangeAccuracy: 1,
      unsupportedClaimRate: 0,
      suggestedFixValidity: 1
    });
  });
  it("uses null for empty denominators instead of a misleading perfect score", () => {
    expect(gradeExpectedFindings([], [])).toMatchObject({
      precision: null,
      recall: null,
      f1: null,
      schemaValidity: null
    });
  });
});
