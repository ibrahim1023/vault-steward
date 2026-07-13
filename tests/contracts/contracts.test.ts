import { describe, expect, it } from "vitest";

import { FINDING_TYPES, type Finding, type VaultStewardError } from "../../src/contracts/index.js";

describe("public contracts", () => {
  it("supports a complete reference-integrity finding", () => {
    const finding: Finding = {
      schemaVersion: 1,
      id: "finding-1",
      scanId: "scan-1",
      type: "broken-reference",
      severity: "medium",
      evidence: [{ notePath: "Home.md", locator: "line:1", excerpt: "[[Missing]]" }],
      affectedNoteIds: ["Home.md"],
      explanation: "The target note is not present in this snapshot.",
      suggestedFixes: [],
      confidence: 1,
      status: "open"
    };

    const error: VaultStewardError = {
      code: "INVALID_REFERENCE",
      message: "Reference is outside the active vault.",
      correlationId: "scan-1",
      retryable: false
    };

    expect(finding.type).toBe("broken-reference");
    expect(FINDING_TYPES).toContain("broken-reference");
    expect(error.retryable).toBe(false);
  });
});
