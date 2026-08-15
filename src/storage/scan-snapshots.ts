import type { Database } from "sql.js";

const TRANSITIONS: Readonly<Record<ScanStatus, readonly ScanStatus[]>> = {
  running: ["completed", "canceled", "failed"],
  completed: [],
  canceled: [],
  failed: []
};

export type ScanStatus = "running" | "completed" | "canceled" | "failed";

export type ScanInput = {
  path: string;
  revisionHash: string;
};

export type CreateScanSnapshot = {
  id: string;
  vaultFingerprint: string;
  startedAt: string;
  configHash: string;
  inputHash: string;
  parserVersion: string;
  files: readonly ScanInput[];
};

export type CompletedScanSnapshot = {
  id: string;
  vaultFingerprint: string;
  status: "completed";
  configHash: string;
  inputHash: string;
  parserVersion: string;
  files: ScanInput[];
};

export class ScanSnapshotRepository {
  constructor(private readonly database: Database) {}

  createSnapshot(snapshot: CreateScanSnapshot): void {
    assertUniquePaths(snapshot.files);
    this.database.run("BEGIN IMMEDIATE");
    try {
      this.database.run(
        "INSERT INTO scans (id, vault_fingerprint, started_at, finished_at, status, config_hash, input_hash, parser_version) VALUES (?, ?, ?, NULL, 'running', ?, ?, ?)",
        [
          snapshot.id,
          snapshot.vaultFingerprint,
          snapshot.startedAt,
          snapshot.configHash,
          snapshot.inputHash,
          snapshot.parserVersion
        ]
      );
      for (const file of snapshot.files) {
        this.database.run(
          "INSERT INTO scan_inputs (scan_id, path, revision_hash) VALUES (?, ?, ?)",
          [snapshot.id, file.path, file.revisionHash]
        );
      }
      this.database.run("COMMIT");
    } catch (error) {
      this.database.run("ROLLBACK");
      throw error;
    }
  }

  transition(scanId: string, nextStatus: Exclude<ScanStatus, "running">, finishedAt: string): void {
    const currentStatus = this.getStatus(scanId);
    if (!TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new Error(`cannot transition scan ${scanId} from ${currentStatus} to ${nextStatus}`);
    }

    this.database.run("UPDATE scans SET status = ?, finished_at = ? WHERE id = ?", [
      nextStatus,
      finishedAt,
      scanId
    ]);
  }

  recoverInterruptedScans(finishedAt: string): number {
    this.database.run(
      "UPDATE scans SET status = 'failed', finished_at = ? WHERE status = 'running'",
      [finishedAt]
    );
    return this.database.getRowsModified();
  }

  getCompletedSnapshot(scanId: string): CompletedScanSnapshot | null {
    return this.getSnapshot(
      "SELECT id, vault_fingerprint, status, config_hash, input_hash, parser_version FROM scans WHERE id = ? AND status = 'completed'",
      [scanId]
    );
  }

  findReusableCompletedSnapshot(
    vaultFingerprint: string,
    inputHash: string,
    parserVersion: string
  ): CompletedScanSnapshot | null {
    return this.getSnapshot(
      "SELECT id, vault_fingerprint, status, config_hash, input_hash, parser_version FROM scans WHERE vault_fingerprint = ? AND input_hash = ? AND parser_version = ? AND status = 'completed' ORDER BY finished_at DESC LIMIT 1",
      [vaultFingerprint, inputHash, parserVersion]
    );
  }

  private getStatus(scanId: string): ScanStatus {
    const status = this.database.exec("SELECT status FROM scans WHERE id = ?", [scanId])[0]
      ?.values[0]?.[0];
    if (!isScanStatus(status)) {
      throw new Error(`unknown scan ${scanId}`);
    }
    return status;
  }

  private getSnapshot(sql: string, params: string[]): CompletedScanSnapshot | null {
    const row = this.database.exec(sql, params)[0]?.values[0];
    if (!row) {
      return null;
    }
    const [id, vaultFingerprint, status, configHash, inputHash, parserVersion] = row;
    if (
      typeof id !== "string" ||
      typeof vaultFingerprint !== "string" ||
      status !== "completed" ||
      typeof configHash !== "string" ||
      typeof inputHash !== "string" ||
      typeof parserVersion !== "string"
    ) {
      throw new Error("stored scan snapshot is invalid");
    }

    const files = this.database
      .exec("SELECT path, revision_hash FROM scan_inputs WHERE scan_id = ? ORDER BY path", [id])[0]
      ?.values.map(([path, revisionHash]) => {
        if (typeof path !== "string" || typeof revisionHash !== "string") {
          throw new Error("stored scan input is invalid");
        }
        return { path, revisionHash };
      });

    return {
      id,
      vaultFingerprint,
      status,
      configHash,
      inputHash,
      parserVersion,
      files: files ?? []
    };
  }
}

function assertUniquePaths(files: readonly ScanInput[]): void {
  const paths = new Set(files.map((file) => file.path));
  if (paths.size !== files.length) {
    throw new Error("scan snapshot includes duplicate paths");
  }
}

function isScanStatus(value: unknown): value is ScanStatus {
  return value === "running" || value === "completed" || value === "canceled" || value === "failed";
}
