import { describe, expect, it } from "vitest";

import { REPLAY_VARIABLES, validateFixtureReplayRecord } from "../../evals/replay/contracts.js";

const validRecord = {
  schemaVersion: 1,
  replayId: "replay-1",
  sourceReportId: "report-1",
  fixtureManifestHash: "a".repeat(64),
  configuration: {
    model: "local-model",
    prompt: "prompt-v1",
    threshold: "threshold-v1",
    retrieval: "retrieval-v1",
    policy: "policy-v1",
    agent: "agent-v1"
  },
  caseResults: [{ id: "reference-missing-ci", outcome: "passed", durationMs: 2, errorCode: null }],
  metrics: { precision: 1, recall: 1, f1: 1, falsePositives: 0, falseNegatives: 0 },
  runtime: { totalDurationMs: 2, peakMemoryBytes: 128, inputTokens: 4, outputTokens: 8 }
} as const;

describe("replay contracts", () => {
  it("exposes the approved replay variables in order", () => {
    expect(REPLAY_VARIABLES).toEqual([
      "model",
      "prompt",
      "threshold",
      "retrieval",
      "policy",
      "agent"
    ]);
  });

  it("accepts bounded replay records and rejects content-bearing fields", () => {
    expect(validateFixtureReplayRecord(validRecord)).toBe(true);
    expect(validateFixtureReplayRecord({ ...validRecord, sourceReportId: "note body" })).toBe(false);
  });

  it("rejects configuration objects with missing or unknown keys", () => {
    expect(
      validateFixtureReplayRecord({
        ...validRecord,
        configuration: { ...validRecord.configuration, extra: "unexpected" }
      })
    ).toBe(false);
    expect(
      validateFixtureReplayRecord({
        ...validRecord,
        configuration: { ...validRecord.configuration, agent: undefined }
      })
    ).toBe(false);
  });
});
