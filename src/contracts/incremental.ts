export type VaultEventKind = "modify" | "create" | "delete" | "rename";

export type VaultEvent = {
  schemaVersion: 1;
  kind: VaultEventKind;
  path: string;
  oldPath?: string;
};

export type ScanPlan =
  | { mode: "incremental"; paths: string[]; reasons: ["modified"] }
  | { mode: "full"; reasons: ["event-overflow" | "unsafe-event" | "ambiguous-event"] };

export type ScanPlanOptions = { maxEvents: number };
