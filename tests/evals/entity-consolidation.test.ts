import { describe, expect, it } from "vitest";

import { gradeEntityCanonicalSelections } from "../../evals/graders/entity-consolidation.js";

describe("entity canonical evaluation", () => {
  it("reports canonical accuracy, abstention, evidence, and repair safety separately", () => {
    const cases = [
      {
        id: "canonical",
        expected: "select" as const,
        expectedCandidateId: "ada-full",
        allowedCandidateIds: ["ada-full", "ada-short"],
        evidenceIds: ["e1", "e2"],
        safeRepair: "applicable" as const
      },
      {
        id: "hard-negative",
        expected: "abstain" as const,
        allowedCandidateIds: ["ada-company", "ada-person"],
        evidenceIds: ["e1", "e2"],
        safeRepair: "not-applicable" as const
      }
    ];
    expect(
      gradeEntityCanonicalSelections(cases, [
        {
          id: "canonical",
          candidateId: "ada-full",
          citedEvidenceIds: ["e1", "e2"],
          schemaValid: true,
          safeRepairPrepared: true
        },
        {
          id: "hard-negative",
          candidateId: null,
          citedEvidenceIds: ["e1"],
          schemaValid: true,
          safeRepairPrepared: false
        }
      ])
    ).toEqual({
      precision: 1,
      recall: 1,
      f1: 1,
      abstentionQuality: 1,
      evidenceValidity: 1,
      incorrectCanonicalRate: 0,
      safeRepairValidity: 1
    });
  });

  it("counts unsupported selections as incorrect canonical choices", () => {
    const metrics = gradeEntityCanonicalSelections(
      [
        {
          id: "negative",
          expected: "abstain",
          allowedCandidateIds: ["one", "two"],
          evidenceIds: ["e1"],
          safeRepair: "not-applicable"
        }
      ],
      [
        {
          id: "negative",
          candidateId: "outside",
          citedEvidenceIds: [],
          schemaValid: false,
          safeRepairPrepared: true
        }
      ]
    );
    expect(metrics).toMatchObject({
      precision: 0,
      abstentionQuality: 0,
      evidenceValidity: 0,
      incorrectCanonicalRate: 1,
      safeRepairValidity: 0
    });
  });
});
