import type { Finding } from "../contracts/index.js";
import { persistReviewQueue } from "../coordinator/normalize.js";
import { ScanSnapshotRepository } from "../storage/scan-snapshots.js";
import { applyMigrations } from "../storage/migrations.js";
import {
  hydrateFinding,
  type ObservabilitySnapshot,
  type ParseProduct,
  VaultStewardRepository
} from "../storage/repositories.js";
import type { ModelTrace } from "../model-provider/structured.js";
import { createSqliteRuntime, type SqliteRuntime } from "../storage/sqlite-runtime.js";
import type { VaultFile } from "../vault-adapter/types.js";
import { validateFindingLineage } from "../contracts/trace.js";

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
    traceConfiguration?: {
      fingerprint: string;
      values: Record<string, string | number | boolean>;
    };
  }): void;
  loadFindings(): Finding[];
  loadHistory(): {
    scans: ReturnType<VaultStewardRepository["listScanHistory"]>;
    lifecycle: ReturnType<VaultStewardRepository["listFindingLifecycle"]>;
  };
  loadObservability(scanId?: string): ObservabilitySnapshot;
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
  repository.pruneExpiredTraceData(new Date().toISOString());
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
      try {
        const correlationId = `scan-${scan.id}`;
        repository.saveTraceSpan({
          schemaVersion: 1,
          id: `${scan.id}:root`,
          scanId: scan.id,
          kind: "governed-scan",
          startedAt: scan.startedAt,
          completedAt: scan.finishedAt,
          outcome: "success",
          correlationId,
          attributes: { fileCount: scan.files.length }
        });
        recordStageSpans(repository, scan, correlationId);
        if (scan.traceConfiguration)
          repository.saveTraceConfiguration({
            scanId: scan.id,
            fingerprint: scan.traceConfiguration.fingerprint,
            values: scan.traceConfiguration.values
          });
        repository.saveParseProducts(scan.id, scan.parserVersion, scan.parseProducts);
        const findings = scan.findings.filter((finding) =>
          validateFindingLineage({
            schemaVersion: 1,
            findingId: finding.id,
            scanId: scan.id,
            evidenceLocators: finding.evidence.map((item) => item.locator),
            parsedArtifactIds: finding.evidence.map((item) => `parse:${item.notePath}`),
            validatorId: "finding-normalization",
            coordinatorDecisionId: `coordinator:${scan.id}`,
            retrievalMetadata: ["not-run"],
            policyEvaluationId: finding.violatedPolicyId ?? "not-run",
            proposalSourceId:
              finding.suggestedFixes.length > 0 ? "deterministic-proposal" : "not-applicable",
            correlationId
          })
        );
        persistReviewQueue(repository, findings);
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
          repository.saveAgentExecution({
            schemaVersion: 1,
            id: `${scan.id}:agent:${index}`,
            scanId: scan.id,
            spanId: `${scan.id}:root`,
            agent: "local-coordinator",
            model: trace.model,
            durationMs: trace.latencyMs,
            retryCount: trace.retries,
            validation: trace.outcome === "success" ? "passed" : "failed",
            correlationId
          });
        }
        for (const finding of findings) {
          repository.saveFindingLineage({
            schemaVersion: 1,
            findingId: finding.id,
            scanId: scan.id,
            evidenceLocators: finding.evidence.map((item) => item.locator),
            parsedArtifactIds: finding.evidence.map((item) => `parse:${item.notePath}`),
            validatorId: "finding-normalization",
            coordinatorDecisionId: `coordinator:${scan.id}`,
            retrievalMetadata: ["not-run"],
            policyEvaluationId: finding.violatedPolicyId ?? "not-run",
            proposalSourceId:
              finding.suggestedFixes.length > 0 ? "deterministic-proposal" : "not-applicable",
            correlationId
          });
        }
        snapshots.transition(scan.id, "completed", scan.finishedAt);
        repository.pruneExpiredTraceData(scan.finishedAt);
      } catch (error) {
        snapshots.transition(scan.id, "failed", scan.finishedAt);
        throw error;
      }
    },
    loadFindings: () => {
      const scanId = repository.latestCompletedScanId();
      if (!scanId) return [];
      return repository.listFindings({ scanId }).flatMap((record) => {
        const finding = hydrateFinding(record);
        return finding ? [finding] : [];
      });
    },
    loadHistory: () => ({
      scans: repository.listScanHistory(20),
      lifecycle: repository.listFindingLifecycle()
    }),
    loadObservability: (scanId) => repository.getObservabilitySnapshot(scanId),
    flush: () => writeRuntime(input.adapter, input.databasePath, runtime),
    close: () => runtime.close()
  };
}

function recordStageSpans(
  repository: VaultStewardRepository,
  scan: Parameters<PluginDatabase["saveCompletedScan"]>[0],
  correlationId: string
): void {
  const agentLatencyMs = scan.modelTraces.reduce((total, trace) => total + trace.latencyMs, 0);
  const retryCount = scan.modelTraces.reduce((total, trace) => total + trace.retries, 0);
  const stages: Array<{ kind: string; attributes: Record<string, string | number | boolean> }> = [
    { kind: "scanner", attributes: { fileCount: scan.files.length } },
    { kind: "indexing", attributes: { parseProductCount: scan.parseProducts.length } },
    { kind: "retrieval", attributes: { notRun: true } },
    {
      kind: "agent",
      attributes: {
        modelCallCount: scan.modelTraces.length,
        retryCount,
        durationMs: agentLatencyMs
      }
    },
    { kind: "validation", attributes: { candidateCount: scan.findings.length } },
    { kind: "policy", attributes: { notRun: true } },
    { kind: "coordinator", attributes: { findingCount: scan.findings.length } },
    { kind: "finding", attributes: { findingCount: scan.findings.length } }
  ];
  for (const stage of stages) {
    repository.saveTraceSpan({
      schemaVersion: 1,
      id: `${scan.id}:${stage.kind}`,
      scanId: scan.id,
      parentSpanId: `${scan.id}:root`,
      kind: stage.kind,
      startedAt: scan.startedAt,
      completedAt: scan.finishedAt,
      outcome: "success",
      correlationId,
      attributes: stage.attributes
    });
  }
}

async function writeRuntime(
  adapter: PluginDatabaseAdapter,
  databasePath: string,
  runtime: SqliteRuntime
): Promise<void> {
  const bytes = runtime.exportDatabase();
  await adapter.writeBinary(databasePath, bytes.slice().buffer);
}
