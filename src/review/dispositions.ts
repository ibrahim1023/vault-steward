import { randomUUID } from "node:crypto";

import type { FindingV2 } from "../contracts/index.js";
import {
  hydrateFinding,
  type ReviewDispositionRecord,
  type VaultStewardRepository
} from "../storage/repositories.js";

export type StewardInboxItem = {
  finding: FindingV2;
  occurrenceId: string;
  disposition: ReviewDispositionRecord | null;
};

export function loadStewardInbox(
  repository: VaultStewardRepository,
  now: string
): {
  items: StewardInboxItem[];
  criticalCount: number;
} {
  const scanId = repository.latestCompletedScanId();
  if (!scanId) return { items: [], criticalCount: 0 };
  const occurrences = new Map(
    repository
      .listFindingOccurrences({ scanId })
      .map((occurrence) => [occurrence.findingId, occurrence])
  );
  const items = repository.listFindings({ scanId }).flatMap((record) => {
    const finding = hydrateFinding(record);
    const occurrence = occurrences.get(record.id);
    if (!finding || finding.schemaVersion !== 2 || !occurrence || finding.status !== "open")
      return [];
    return [
      {
        finding,
        occurrenceId: occurrence.occurrenceId,
        disposition: repository.getEffectiveReviewDisposition({
          stableKey: occurrence.stableKey,
          evidenceRevisionKey: occurrence.evidenceRevisionKey,
          now
        })
      }
    ];
  });
  return {
    items,
    criticalCount: items.filter((item) => item.finding.severity === "critical").length
  };
}

export type InboxDispositionRequest = {
  occurrenceIds: readonly string[];
  kind: "acknowledged" | "ignored" | "expected" | "snoozed";
  createdAt: string;
  untilAt?: string;
  untilEvidenceChanges?: boolean;
};

export function restoreInboxDisposition(
  repository: VaultStewardRepository,
  request: { occurrenceId: string; createdAt: string },
  createId: () => string = randomUUID
): void {
  const item = loadStewardInbox(repository, request.createdAt).items.find(
    (candidate) => candidate.occurrenceId === request.occurrenceId
  );
  if (!item || !item.disposition) throw new Error("current Inbox disposition is unavailable");
  const restoredId = item.disposition.id;
  repository.withTransaction(() => {
    repository.appendReviewDisposition({
      id: createId(),
      stableKey: item.finding.stableKey,
      sourceOccurrenceId: item.occurrenceId,
      sourceEvidenceRevisionKey: item.finding.evidenceRevisionKey,
      kind: "restored",
      reason: null,
      createdAt: request.createdAt,
      untilAt: null,
      untilEvidenceChanges: false,
      restoresDispositionId: restoredId
    });
    repository.appendIntegrityEvent({
      schemaVersion: 1,
      id: createId(),
      category: "review",
      kind: "disposition-restored",
      occurredAt: request.createdAt,
      scanId: item.finding.scanId,
      stableKey: item.finding.stableKey,
      occurrenceId: item.occurrenceId,
      safeMetadata: {}
    });
  });
}

export function reviewInboxOccurrences(
  repository: VaultStewardRepository,
  request: InboxDispositionRequest,
  createId: () => string = randomUUID
): void {
  if (
    request.occurrenceIds.length === 0 ||
    new Set(request.occurrenceIds).size !== request.occurrenceIds.length
  ) {
    throw new Error("select distinct current Inbox occurrences");
  }
  if (
    request.kind === "snoozed" &&
    request.untilAt !== undefined &&
    Date.parse(request.untilAt) <= Date.parse(request.createdAt)
  ) {
    throw new Error("dated snooze must end in the future");
  }
  const items = new Map(
    loadStewardInbox(repository, request.createdAt).items.map((item) => [item.occurrenceId, item])
  );
  const selected = request.occurrenceIds.map((id) => {
    const item = items.get(id);
    if (!item) throw new Error("Inbox occurrence is no longer current");
    return item;
  });
  repository.withTransaction(() => {
    for (const item of selected) {
      const dispositionId = createId();
      repository.appendReviewDisposition({
        id: dispositionId,
        stableKey: item.finding.stableKey,
        sourceOccurrenceId: item.occurrenceId,
        sourceEvidenceRevisionKey: item.finding.evidenceRevisionKey,
        kind: request.kind,
        reason: null,
        createdAt: request.createdAt,
        untilAt: request.untilAt ?? null,
        untilEvidenceChanges: request.untilEvidenceChanges ?? false,
        restoresDispositionId: null
      });
      repository.appendIntegrityEvent({
        schemaVersion: 1,
        id: createId(),
        category: "review",
        kind: `disposition-${request.kind}`,
        occurredAt: request.createdAt,
        scanId: item.finding.scanId,
        stableKey: item.finding.stableKey,
        occurrenceId: item.occurrenceId,
        safeMetadata: {}
      });
    }
  });
}
