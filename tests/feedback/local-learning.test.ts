import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/contracts/index.js";
import {
  findingFeedbackPattern,
  isLocallySuppressed,
  recurringSuppressionCandidates
} from "../../src/feedback/local-learning.js";
import type { ReviewerFeedbackRecord } from "../../src/storage/repositories.js";

const finding: Finding = {
  schemaVersion: 1,
  id: "scan-a:finding-a",
  scanId: "scan-a",
  type: "task",
  severity: "low",
  evidence: [{ notePath: "Work/Plan.md", locator: "line:4", excerpt: "- [ ] Review" }],
  affectedNoteIds: ["Work/Plan.md"],
  explanation: "Task review is orphaned.",
  suggestedFixes: [],
  confidence: 1,
  status: "open"
};

function feedback(
  index: number,
  patternKey = findingFeedbackPattern(finding)
): ReviewerFeedbackRecord {
  return {
    id: `feedback-${index}`,
    findingId: `scan-${index}:finding`,
    proposalId: null,
    verdict: "false-positive",
    label: "expected-exception",
    patternKey,
    createdAt: "2026-08-02T00:00:00.000Z"
  };
}

describe("local feedback learning", () => {
  it("only suggests reviewed local suppression after repeated matching feedback", () => {
    expect(recurringSuppressionCandidates([feedback(1), feedback(2)])).toEqual([]);
    expect(recurringSuppressionCandidates([feedback(1), feedback(2), feedback(3)])).toEqual([
      { key: "task:Work/Plan.md", count: 3 }
    ]);
  });

  it("uses only local type and affected-note metadata for presentation suppression", () => {
    const pattern = findingFeedbackPattern(finding);
    expect(isLocallySuppressed(finding, [pattern])).toBe(true);
    expect(isLocallySuppressed(finding, [])).toBe(false);
  });
});
