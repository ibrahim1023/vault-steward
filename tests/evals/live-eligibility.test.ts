import { describe, expect, it } from "vitest";

import { assessLiveReplayEligibility } from "../../evals/replay/live-eligibility.js";
import type { CompletedScanSnapshot } from "../../src/storage/scan-snapshots.js";

const snapshot: CompletedScanSnapshot = {
  id: "scan-1",
  vaultFingerprint: "vault-1",
  status: "completed",
  configHash: "config-1",
  inputHash: "input-1",
  parserVersion: "parser-1",
  files: [{ path: "Home.md", revisionHash: "revision-1" }]
};

describe("live replay eligibility", () => {
  it("reports retained fixtures as eligible when required metadata is present", () => {
    expect(
      assessLiveReplayEligibility({
        scanId: "scan-1",
        snapshot,
        trace: { fingerprint: "b".repeat(64) },
        source: "retained-fixture"
      })
    ).toEqual({ eligible: true, scanId: "scan-1", source: "retained-fixture" });
  });

  it("reports unavailable source content even when metadata is complete", () => {
    expect(
      assessLiveReplayEligibility({
        scanId: "scan-1",
        snapshot,
        trace: { fingerprint: "b".repeat(64) },
        source: "none"
      })
    ).toEqual({ eligible: false, scanId: "scan-1", reasons: ["unavailable-source-content"] });
  });

  it("returns explicit reasons for missing replay metadata", () => {
    expect(
      assessLiveReplayEligibility({
        scanId: "scan-1",
        snapshot: { ...snapshot, configHash: "" },
        trace: { fingerprint: "" },
        source: "retained-fixture"
      })
    ).toEqual({
      eligible: false,
      scanId: "scan-1",
      reasons: ["missing-configuration-fingerprint", "missing-trace-fingerprint"]
    });
  });
});
