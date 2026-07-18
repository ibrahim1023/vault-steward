import { describe, expect, it } from "vitest";

import { summarizePolicyCoverage } from "../../evals/policy-coverage/summarize.js";

describe("policy coverage reporting", () => {
  it("reports unexercised policy versions without fabricating reviewer data", () => {
    const report = summarizePolicyCoverage({
      definitions: [{ policyId: "tasks", version: "v1", valid: true, deprecated: false }],
      executions: [],
      fixtures: [],
      reviews: []
    });

    expect(report.rows).toEqual([
      expect.objectContaining({
        policyId: "tasks",
        version: "v1",
        defined: true,
        executedCount: 0,
        triggeredCount: 0,
        fixtureCoverage: false,
        reviewerFalsePositiveRate: null,
        status: "unexercised",
        suggestion: "add-fixture"
      })
    ]);
  });

  it("uses stable status precedence and aggregate review signals", () => {
    const report = summarizePolicyCoverage({
      definitions: [
        { policyId: "deprecated", version: "v1", valid: true, deprecated: true },
        { policyId: "review", version: "v1", valid: true, deprecated: false },
        { policyId: "invalid", version: "v1", valid: false, deprecated: false }
      ],
      executions: [
        { policyId: "deprecated", version: "v1", violationCount: 1 },
        { policyId: "review", version: "v1", violationCount: 2 }
      ],
      fixtures: [
        { policyId: "deprecated", version: "v1" },
        { policyId: "review", version: "v1" }
      ],
      reviews: [{ policyId: "review", version: "v1", falsePositiveCount: 3, totalCount: 10 }]
    });

    expect(report.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ policyId: "deprecated", status: "deprecated" }),
        expect.objectContaining({
          policyId: "review",
          reviewerFalsePositiveRate: 0.3,
          status: "review-needed",
          suggestion: "review-false-positives"
        }),
        expect.objectContaining({ policyId: "invalid", defined: false, status: "unexercised" })
      ])
    );
  });

  it("rejects references to unknown policy versions and unsafe aggregate input", () => {
    expect(() =>
      summarizePolicyCoverage({
        definitions: [{ policyId: "tasks", version: "v1", valid: true, deprecated: false }],
        executions: [{ policyId: "missing", version: "v1", violationCount: 0 }],
        fixtures: [],
        reviews: []
      })
    ).toThrow("unknown");
    expect(() =>
      summarizePolicyCoverage({
        definitions: [{ policyId: "tasks", version: "v1", valid: true, deprecated: false }],
        executions: [],
        fixtures: [],
        reviews: [{ policyId: "tasks", version: "v1", falsePositiveCount: 2, totalCount: 1 }]
      })
    ).toThrow("falsePositiveCount");
  });
});
