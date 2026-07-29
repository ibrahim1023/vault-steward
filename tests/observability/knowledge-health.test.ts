import { describe, expect, it } from "vitest";

import { summarizeKnowledgeHealth } from "../../src/observability/knowledge-health.js";

describe("knowledge health", () => {
  it("keeps resolution and recurrence semantics distinct", () => {
    expect(
      summarizeKnowledgeHealth([
        {
          type: "task",
          severity: "medium",
          evidenceJson: "[]",
          firstSeen: "a",
          lastSeen: "b",
          occurrences: 2,
          resolved: false,
          stale: true
        },
        {
          type: "reference",
          severity: "low",
          evidenceJson: "[]",
          firstSeen: "a",
          lastSeen: "b",
          occurrences: 1,
          resolved: true,
          stale: false
        }
      ])
    ).toMatchObject({
      activeFindings: 1,
      resolvedFindings: 1,
      recurringFindings: 1,
      staleFindings: 1
    });
  });
});
