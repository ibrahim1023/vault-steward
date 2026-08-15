export const SYNTHETIC_DEFECT_KINDS = [
  "contradiction",
  "duplicate-entity",
  "broken-reference",
  "stale-note",
  "orphan-task",
  "schema-violation",
  "unresolved-decision"
] as const;

export type SyntheticDefectKind = (typeof SYNTHETIC_DEFECT_KINDS)[number];

export type SyntheticVaultConfig = {
  seed: string;
  noteCount: number;
  folderDepth: number;
  linkDensity: number;
  entityCount: number;
  taskCount: number;
  decisionCount: number;
  contradictionRate: number;
  duplicateEntityRate: number;
  brokenReferenceRate: number;
  stalenessRate: number;
  orphanTaskRate: number;
  schemaViolationRate: number;
  unresolvedDecisionRate: number;
};

export type SyntheticFile = {
  path: string;
  content: string;
};

export type SyntheticGroundTruthDefect = {
  id: string;
  kind: SyntheticDefectKind;
  notePath: string;
  locator: string;
};

export type SyntheticGroundTruth = {
  schemaVersion: 1;
  seed: string;
  configurationHash: string;
  defects: SyntheticGroundTruthDefect[];
};

export type GeneratedSyntheticVault = {
  schemaVersion: 1;
  files: SyntheticFile[];
  groundTruth: SyntheticGroundTruth;
  achievedDefectCounts: Record<SyntheticDefectKind, number>;
};
