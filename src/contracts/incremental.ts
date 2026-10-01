export type VaultEventKind = "modify" | "create" | "delete" | "rename";

export type VaultEvent = {
  schemaVersion: 1;
  kind: VaultEventKind;
  path: string;
  oldPath?: string;
};

export type VerifiedRename = { oldPath: string; path: string; subjectId: string };

export type ProcessedVaultEventBatch = {
  events: readonly VaultEvent[];
  verifiedRenames: readonly VerifiedRename[];
  subjectPersistenceFailed: boolean;
};

export type ScanPlan =
  | { mode: "incremental"; paths: string[]; reasons: ["modified"] }
  | {
      mode: "full";
      reasons: [
        "event-overflow" | "unsafe-event" | "ambiguous-event" | "subject-persistence-failed"
      ];
    };

export type ScanPlanOptions = { maxEvents: number; subjectPersistenceFailed?: boolean };
