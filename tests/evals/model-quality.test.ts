import { describe, expect, it } from "vitest";

import { gradeModelQuality } from "../../evals/graders/model-quality.js";

describe("model quality grader", () => {
  it("reports deterministic classification and evidence metrics without note content", () => {
    const cases = [
      { id: "supported", expected: "candidate", evidence: ["A.md:line:1"] },
      { id: "unsupported", expected: "reject", evidence: ["B.md:line:1"] }
    ] as const;
    expect(
      gradeModelQuality(cases as never, [
        {
          id: "supported",
          predicted: "candidate",
          citedEvidence: ["A.md:line:1"],
          schemaValid: true,
          severityMatches: true
        },
        {
          id: "unsupported",
          predicted: "candidate",
          citedEvidence: [],
          schemaValid: true,
          severityMatches: false
        }
      ])
    ).toMatchObject({
      precision: 0.5,
      recall: 1,
      falsePositives: 1,
      citationValidity: 0.5,
      unsupportedClaimRate: 0.5
    });
  });
});
