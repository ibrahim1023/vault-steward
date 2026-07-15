import type { Finding } from "../contracts/index.js";
import { persistReviewQueue } from "../coordinator/normalize.js";
import { ScanSnapshotRepository } from "../storage/scan-snapshots.js";
import { applyMigrations } from "../storage/migrations.js";
import {
  hydrateFinding,
  type ParseProduct,
  VaultStewardRepository
} from "../storage/repositories.js";
import type { ModelTrace } from "../model-provider/structured.js";
import { createSqliteRuntime, type SqliteRuntime } from "../storage/sqlite-runtime.js";
import type { VaultFile } from "../vault-adapter/types.js";

export type PluginDatabaseAdapter = {
  exists(path: string): Promise<boolean>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
};

export type PluginDatabase = {
  repository: VaultStewardRepository;
  saveCompletedScan(input: {
    id: string;
    vaultFingerprint: string;
    configHash: string;
    inputHash: string;
    parserVersion: string;
    startedAt: string;
    finishedAt: string;
    files: readonly VaultFile[];
    parseProducts: readonly ParseProduct[];
    findings: readonly Finding[];
    modelTraces: readonly ModelTrace[];
  }): void;
  loadFindings(): Finding[];
  loadHistory(): {
    scans: ReturnType<VaultStewardRepository["listScanHistory"]>;
    lifecycle: ReturnType<VaultStewardRepository["listFindingLifecycle"]>;
  };
  flush(): Promise<void>;
  close(): void;
};

export async function openPluginDatabase(input: {
  adapter: PluginDatabaseAdapter;
  databasePath: string;
  locateFile: (file: string) => string;
}): Promise<PluginDatabase> {
  const databaseBytes = (await input.adapter.exists(input.databasePath))
    ? new Uint8Array(await input.adapter.readBinary(input.databasePath))
    : undefined;
  const runtime = await createSqliteRuntime({
    locateFile: input.locateFile,
    ...(databaseBytes ? { databaseBytes } : {})
  });
  applyMigrations(runtime.database);
  const repository = new VaultStewardRepository(runtime.database);
  const snapshots = new ScanSnapshotRepository(runtime.database);
  snapshots.recoverInterruptedScans(new Date().toISOString());
  await writeRuntime(input.adapter, input.databasePath, runtime);

  return {
    repository,
    saveCompletedScan(scan) {
      snapshots.createSnapshot({
        id: scan.id,
        vaultFingerprint: scan.vaultFingerprint,
        startedAt: scan.startedAt,
        configHash: scan.configHash,
        inputHash: scan.inputHash,
        parserVersion: scan.parserVersion,
        files: scan.files.map((file) => ({ path: file.path, revisionHash: file.revision ?? "" }))
      });
      repository.saveParseProducts(scan.id, scan.parserVersion, scan.parseProducts);
      persistReviewQueue(repository, scan.findings);
      for (const [index, trace] of scan.modelTraces.entries()) {
        repository.saveModelTrace({
          id: `${scan.id}:trace:${index}`,
          scanId: scan.id,
          requestMetadataJson: JSON.stringify({
            provider: trace.provider,
            model: trace.model,
            retries: trace.retries
          }),
          schemaVersion: 1,
          durationMs: trace.latencyMs,
          inputTokens: 0,
          outputTokens: 0,
          outcome: trace.outcome
        });
      }
      snapshots.transition(scan.id, "completed", scan.finishedAt);
    },
    loadFindings: () =>
      repository.listFindings({}).flatMap((record) => {
        const finding = hydrateFinding(record);
        return finding ? [finding] : [];
      }),
    loadHistory: () => ({
      scans: repository.listScanHistory(20),
      lifecycle: repository.listFindingLifecycle()
    }),
    flush: () => writeRuntime(input.adapter, input.databasePath, runtime),
    close: () => runtime.close()
  };
}

async function writeRuntime(
  adapter: PluginDatabaseAdapter,
  databasePath: string,
  runtime: SqliteRuntime
): Promise<void> {
  const bytes = runtime.exportDatabase();
  await adapter.writeBinary(databasePath, bytes.slice().buffer);
}
