import { describe, expect, it } from "vitest";

import { gradeReferenceIntegrity } from "../../evals/graders/reference-integrity.js";

describe("reference-integrity grader", () => {
  it("fails a result that omits an expected evidence locator", () => {
    const report = gradeReferenceIntegrity(
      [
        {
          id: "missing-evidence",
          expected: [{ type: "broken-reference", notePath: "Home.md", locator: "line:1" }]
        }
      ],
      [{ id: "missing-evidence", actual: [] }]
    );

    expect(report.evidenceValidity).toBe(0);
    expect(report.recall).toBe(0);
  });
});
