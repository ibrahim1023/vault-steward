import { compareFindingOccurrences, type FindingTransition } from "../findings/compare.js";
import type { VaultStewardRepository } from "../storage/repositories.js";
import type { ScanSnapshotRepository } from "../storage/scan-snapshots.js";

type ChangesItem = FindingTransition & { family: string; subtype: string };

export type ChangesSummary =
  | { status: "no-scan" | "legacy"; currentScanId: string | null }
  | { status: "baseline"; currentScanId: string; availableBaselineScanIds: readonly string[] }
  | {
      status: "compared";
      currentScanId: string;
      baselineScanId: string;
      availableBaselineScanIds: readonly string[];
      new: readonly ChangesItem[];
      changed: readonly ChangesItem[];
      recurring: readonly ChangesItem[];
      resolved: readonly ChangesItem[];
      unchanged: readonly ChangesItem[];
    };

export function buildChangesSummary(
  repository: VaultStewardRepository,
  snapshots: ScanSnapshotRepository,
  selectedBaselineId?: string
): ChangesSummary {
  const currentScanId = repository.latestCompletedScanId();
  if (!currentScanId) return { status: "no-scan", currentScanId: null };
  const current = snapshots.getCompletedSnapshot(currentScanId);
  if (!current || current.identityProfileHash === "legacy") {
    return { status: "legacy", currentScanId };
  }
  const comparable = snapshots.listComparableCompletedSnapshots(
    current.vaultFingerprint,
    current.identityProfileHash
  );
  const currentIndex = comparable.findIndex((snapshot) => snapshot.id === currentScanId);
  if (currentIndex < 0) throw new Error("current scan is not comparable with itself");
  const availableBaselineScanIds = comparable.slice(0, currentIndex).map((snapshot) => snapshot.id);
  if (availableBaselineScanIds.length === 0) {
    if (selectedBaselineId) throw new Error("selected baseline is not a retained compatible scan");
    return { status: "baseline", currentScanId, availableBaselineScanIds };
  }
  const baselineScanId = selectedBaselineId ?? availableBaselineScanIds.at(-1)!;
  const baselineIndex = availableBaselineScanIds.indexOf(baselineScanId);
  if (baselineIndex < 0) throw new Error("selected baseline is not a retained compatible scan");
  const transitions = compareFindingOccurrences({
    previous: repository.listFindingOccurrences({ scanId: baselineScanId }),
    current: repository.listFindingOccurrences({ scanId: currentScanId }),
    historical: comparable
      .slice(0, baselineIndex)
      .map((snapshot) => repository.listFindingOccurrences({ scanId: snapshot.id }))
  });
  const identities = new Map(
    repository.listFindingIdentities().map((identity) => [identity.stableKey, identity])
  );
  const byKind = (kind: FindingTransition["kind"]): ChangesItem[] =>
    transitions
      .filter((transition) => transition.kind === kind)
      .map((transition) => {
        const identity = identities.get(transition.stableKey);
        if (!identity || identity.identityVersion !== 1) {
          throw new Error("comparable finding identity is unavailable");
        }
        return { ...transition, family: identity.family, subtype: identity.subtype };
      });
  return {
    status: "compared",
    currentScanId,
    baselineScanId,
    availableBaselineScanIds,
    new: byKind("new"),
    changed: byKind("changed"),
    recurring: byKind("recurring"),
    resolved: byKind("resolved"),
    unchanged: byKind("unchanged")
  };
}
