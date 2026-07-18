import type { CompletedScanSnapshot } from "../../src/storage/scan-snapshots.js";
import type { LiveReplayEligibility, ReplayIneligibilityReason } from "./contracts.js";

export type LiveReplayInput = {
  scanId: string;
  snapshot: CompletedScanSnapshot | null;
  trace: { fingerprint: string } | null;
  source: "none" | "retained-fixture";
};

export function assessLiveReplayEligibility(input: LiveReplayInput): LiveReplayEligibility {
  const reasons: ReplayIneligibilityReason[] = [];

  if (!input.snapshot) {
    reasons.push("missing-scan-snapshot");
  } else {
    if (!input.snapshot.inputHash) reasons.push("missing-input-hash");
    if (!input.snapshot.parserVersion) reasons.push("missing-parser-version");
    if (!input.snapshot.configHash) reasons.push("missing-configuration-fingerprint");
  }

  if (!input.trace?.fingerprint) reasons.push("missing-trace-fingerprint");
  if (input.source !== "retained-fixture") reasons.push("unavailable-source-content");

  return reasons.length === 0
    ? { eligible: true, scanId: input.scanId, source: "retained-fixture" }
    : { eligible: false, scanId: input.scanId, reasons };
}
