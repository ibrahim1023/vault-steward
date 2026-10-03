import { randomUUID } from "node:crypto";

import type { Finding } from "../contracts/index.js";
import type {
  ProcessedVaultEventBatch,
  VaultEvent,
  VerifiedRename
} from "../contracts/incremental.js";
import { persistReviewQueueInTransaction } from "../coordinator/normalize.js";
import { compareFindingOccurrences, type FindingTransition } from "../findings/compare.js";
import {
  restoreInboxDisposition,
  reviewInboxOccurrences,
  type InboxDispositionRequest
} from "../review/dispositions.js";
import { buildChangesSummary, type ChangesSummary } from "../maintenance/changes.js";
import { ScanSnapshotRepository } from "../storage/scan-snapshots.js";
import { applyMigrations } from "../storage/migrations.js";
import {
  hydrateFinding,
  type ObservabilitySnapshot,
  type ParseProduct,
  VaultStewardRepository
} from "../storage/repositories.js";
import type { ModelTrace } from "../model-provider/structured.js";
import {
  createSqliteRuntime,
  type SqliteRuntime,
  type SqliteRuntimeOptions
} from "../storage/sqlite-runtime.js";
import { normalizeVaultPath } from "../scanner/scan.js";
import type { VaultFile } from "../vault-adapter/types.js";
import { validateFindingLineage } from "../contracts/trace.js";

export type PluginDatabaseAdapter = {
  exists(path: string): Promise<boolean>;
  readBinary(path: string): Promise<ArrayBuffer>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
};

export type PluginDatabase = {
  readonly repository: VaultStewardRepository;
  hasPendingInboxActions(): boolean;
  saveCompletedScan(input: {
    id: string;
    vaultFingerprint: string;
    configHash: string;
    inputHash: string;
    parserVersion: string;
    startedAt: string;
    finishedAt: string;
    files: readonly VaultFile[];
    identityProfileHash?: string;
    parseProducts: readonly ParseProduct[];
    findings: readonly Finding[];
    modelTraces: readonly ModelTrace[];
    traceConfiguration?: {
      fingerprint: string;
      values: Record<string, string | number | boolean>;
    };
  }): void;
  loadFindings(): Finding[];
  loadChangesSummary(baselineScanId?: string): ChangesSummary;
  loadIntegrityTimeline(
    beforeSequence?: number
  ): ReturnType<VaultStewardRepository["listIntegrityEvents"]>;
  saveInboxReview(request: InboxDispositionRequest): Promise<void>;
  restoreInboxReview(request: { occurrenceId: string; createdAt: string }): Promise<void>;
  loadHistory(): {
    scans: ReturnType<VaultStewardRepository["listScanHistory"]>;
    lifecycle: ReturnType<VaultStewardRepository["listFindingLifecycle"]>;
  };
  loadObservability(scanId?: string): ObservabilitySnapshot;
  processVaultEvents(
    events: readonly VaultEvent[],
    observedAt: string
  ): Promise<ProcessedVaultEventBatch>;
  synchronizeNoteSubjects(
    paths: readonly string[],
    observedAt: string
  ): Promise<ReadonlyMap<string, string>>;
  flush(): Promise<void>;
  close(): void;
};

export async function openPluginDatabase(input: {
  adapter: PluginDatabaseAdapter;
  databasePath: string;
  locateFile?: (file: string) => string;
  wasmBinary?: ArrayBuffer;
  createSubjectId?: () => string;
  createEventId?: () => string;
}): Promise<PluginDatabase> {
  const runtimeOptions: SqliteRuntimeOptions = {
    ...(input.locateFile ? { locateFile: input.locateFile } : {}),
    ...(input.wasmBinary ? { wasmBinary: input.wasmBinary } : {})
  };
  const databaseBytes = (await input.adapter.exists(input.databasePath))
    ? new Uint8Array(await input.adapter.readBinary(input.databasePath))
    : undefined;
  const createSubjectId = input.createSubjectId ?? randomUUID;
  const createEventId = input.createEventId ?? randomUUID;
  let runtime = await createSqliteRuntime({
    ...runtimeOptions,
    ...(databaseBytes ? { databaseBytes } : {})
  });
  applyMigrations(runtime.database);
  let repository = new VaultStewardRepository(runtime.database);
  repository.backfillLegacyFindingOccurrences();
  let snapshots = new ScanSnapshotRepository(runtime.database);
  const recoveredAt = new Date().toISOString();
  for (const interruptedId of snapshots.listInterruptedScanIds()) {
    repository.withTransaction(() => {
      snapshots.transition(interruptedId, "failed", recoveredAt);
      repository.appendIntegrityEvent({
        schemaVersion: 1,
        id: createEventId(),
        category: "operational",
        kind: "scan-failed",
        occurredAt: recoveredAt,
        scanId: interruptedId,
        safeMetadata: { reason: "interrupted" }
      });
    });
  }
  repository.pruneExpiredTraceData(new Date().toISOString());
  await writeRuntime(input.adapter, input.databasePath, runtime);

  async function restoreRuntime(bytes: Uint8Array): Promise<void> {
    runtime.close();
    runtime = await createSqliteRuntime({ ...runtimeOptions, databaseBytes: bytes });
    repository = new VaultStewardRepository(runtime.database);
    snapshots = new ScanSnapshotRepository(runtime.database);
  }

  let inboxPersistenceQueue: Promise<void> = Promise.resolve();
  let inboxPending = 0;

  function assertNoPendingInboxAction(): void {
    if (inboxPending > 0) throw new Error("An Inbox decision is still being persisted");
  }

  function persistInboxAction(operation: () => void): Promise<void> {
    inboxPending += 1;
    const result = inboxPersistenceQueue.then(async () => {
      const backup = runtime.exportDatabase();
      try {
        operation();
        await writeRuntime(input.adapter, input.databasePath, runtime);
      } catch (error) {
        await restoreRuntime(backup);
        throw error;
      }
    });
    inboxPersistenceQueue = result.then(
      () => {
        inboxPending -= 1;
      },
      () => {
        inboxPending -= 1;
      }
    );
    return result;
  }

  function safeSubjectPath(path: string): string | null {
    const normalized = normalizeVaultPath(path);
    return isSafeSubjectPath(normalized) ? normalized : null;
  }

  async function processVaultEvents(
    events: readonly VaultEvent[],
    observedAt: string
  ): Promise<ProcessedVaultEventBatch> {
    assertNoPendingInboxAction();
    const backup = runtime.exportDatabase();
    const verifiedRenames: VerifiedRename[] = [];
    try {
      for (const event of events) {
        if (event.kind === "create") {
          const path = safeSubjectPath(event.path);
          if (path && !repository.findNoteSubjectByPath(path)) {
            repository.bindNoteSubject({ subjectId: createSubjectId(), path, observedAt });
          }
        } else if (event.kind === "delete") {
          const path = safeSubjectPath(event.path);
          const record = path ? repository.findNoteSubjectByPath(path) : null;
          if (path && record) {
            repository.deleteNoteSubject({
              subjectId: record.subjectId,
              path,
              deletedAt: observedAt
            });
          }
        } else if (event.kind === "rename") {
          const oldPath = event.oldPath ? safeSubjectPath(event.oldPath) : null;
          const newPath = safeSubjectPath(event.path);
          const source = oldPath ? repository.findNoteSubjectByPath(oldPath) : null;
          const destination = newPath ? repository.findNoteSubjectByPath(newPath) : null;
          if (oldPath && newPath && source && !destination) {
            repository.renameNoteSubject({
              subjectId: source.subjectId,
              oldPath,
              newPath,
              observedAt
            });
            verifiedRenames.push({ oldPath, path: newPath, subjectId: source.subjectId });
          } else {
            if (source) {
              repository.deleteNoteSubject({
                subjectId: source.subjectId,
                path: source.currentPath!,
                deletedAt: observedAt
              });
            }
            if (destination && destination.subjectId !== source?.subjectId) {
              repository.deleteNoteSubject({
                subjectId: destination.subjectId,
                path: destination.currentPath!,
                deletedAt: observedAt
              });
            }
          }
        }
      }
      await writeRuntime(input.adapter, input.databasePath, runtime);
    } catch {
      await restoreRuntime(backup);
      return { events, verifiedRenames: [], subjectPersistenceFailed: true };
    }
    return { events, verifiedRenames, subjectPersistenceFailed: false };
  }

  async function synchronizeNoteSubjects(
    paths: readonly string[],
    observedAt: string
  ): Promise<ReadonlyMap<string, string>> {
    const current = new Set<string>();
    for (const path of paths) {
      const normalized = safeSubjectPath(path);
      if (!normalized) throw new Error("vault path is unsafe");
      current.add(normalized);
    }
    assertNoPendingInboxAction();
    const backup = runtime.exportDatabase();
    try {
      for (const record of repository.listActiveNoteSubjects()) {
        if (record.currentPath !== null && !current.has(record.currentPath)) {
          repository.deleteNoteSubject({
            subjectId: record.subjectId,
            path: record.currentPath,
            deletedAt: observedAt
          });
        }
      }
      const subjects = new Map<string, string>();
      for (const path of [...current].sort((left, right) => left.localeCompare(right))) {
        const existing = repository.findNoteSubjectByPath(path);
        subjects.set(
          path,
          existing?.subjectId ??
            repository.bindNoteSubject({ subjectId: createSubjectId(), path, observedAt }).subjectId
        );
      }
      await writeRuntime(input.adapter, input.databasePath, runtime);
      return subjects;
    } catch (error) {
      await restoreRuntime(backup);
      throw error;
    }
  }

  return {
    get repository() {
      return repository;
    },
    hasPendingInboxActions: () => inboxPending > 0,
    saveCompletedScan(scan) {
      assertNoPendingInboxAction();
      const correlationId = `scan-${scan.id}`;
      repository.withTransaction(() => {
        snapshots.createSnapshotInTransaction({
          id: scan.id,
          vaultFingerprint: scan.vaultFingerprint,
          startedAt: scan.startedAt,
          configHash: scan.configHash,
          inputHash: scan.inputHash,
          parserVersion: scan.parserVersion,
          ...(scan.identityProfileHash !== undefined
            ? { identityProfileHash: scan.identityProfileHash }
            : {}),
          files: scan.files.map((file) => ({
            path: file.path,
            revisionHash: file.revision ?? ""
          }))
        });
        repository.appendIntegrityEvent({
          schemaVersion: 1,
          id: createEventId(),
          category: "operational",
          kind: "scan-started",
          occurredAt: scan.startedAt,
          scanId: scan.id,
          safeMetadata: { count: scan.files.length }
        });
      });
      try {
        repository.withTransaction(() => {
          for (const finding of scan.findings) {
            if (finding.scanId !== scan.id) {
              throw new Error("finding scanId does not match the completed scan");
            }
          }
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
          const findings = persistReviewQueueInTransaction(
            repository,
            scan.findings.filter((finding) =>
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
            )
          );
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
          const comparable = snapshots.listComparableCompletedSnapshots(
            scan.vaultFingerprint,
            scan.identityProfileHash ?? "legacy"
          );
          if (comparable.length > 0) {
            const baseline = comparable[comparable.length - 1]!;
            const transitions = compareFindingOccurrences({
              previous: repository.listFindingOccurrences({ scanId: baseline.id }),
              current: repository.listFindingOccurrences({ scanId: scan.id }),
              historical: comparable
                .slice(0, -1)
                .map((snapshot) => repository.listFindingOccurrences({ scanId: snapshot.id }))
            });
            for (const transition of transitions) {
              if (transition.kind === "unchanged") continue;
              const kind = REVIEW_EVENT_KINDS[transition.kind];
              repository.appendIntegrityEvent({
                schemaVersion: 1,
                id: createEventId(),
                category: "review",
                kind,
                occurredAt: scan.finishedAt,
                scanId: scan.id,
                stableKey: transition.stableKey,
                occurrenceId:
                  transition.currentOccurrenceIds[0] ?? transition.previousOccurrenceIds[0]!,
                safeMetadata: {
                  count: Math.max(
                    transition.previousOccurrenceIds.length,
                    transition.currentOccurrenceIds.length
                  )
                }
              });
            }
          }
          snapshots.transition(scan.id, "completed", scan.finishedAt);
          repository.appendIntegrityEvent({
            schemaVersion: 1,
            id: createEventId(),
            category: "operational",
            kind: "scan-completed",
            occurredAt: scan.finishedAt,
            scanId: scan.id,
            safeMetadata: { count: findings.length }
          });
        });
      } catch (error) {
        if (snapshots.getScanStatus(scan.id) === "running") {
          repository.withTransaction(() => {
            snapshots.transition(scan.id, "failed", scan.finishedAt);
            repository.appendIntegrityEvent({
              schemaVersion: 1,
              id: createEventId(),
              category: "operational",
              kind: "scan-failed",
              occurredAt: new Date().toISOString(),
              scanId: scan.id,
              safeMetadata: { reason: "persistence" }
            });
          });
        }
        throw error;
      }
      repository.pruneExpiredTraceData(scan.finishedAt);
    },
    loadFindings: () => {
      const scanId = repository.latestCompletedScanId();
      if (!scanId) return [];
      return repository.listFindings({ scanId }).flatMap((record) => {
        const finding = hydrateFinding(record);
        return finding ? [finding] : [];
      });
    },
    loadChangesSummary: (baselineScanId) =>
      buildChangesSummary(repository, snapshots, baselineScanId),
    loadIntegrityTimeline: (beforeSequence) =>
      repository.listIntegrityEvents({
        limit: 100,
        ...(beforeSequence !== undefined ? { beforeSequence } : {})
      }),
    saveInboxReview: (request) =>
      persistInboxAction(() => reviewInboxOccurrences(repository, request)),
    restoreInboxReview: (request) =>
      persistInboxAction(() => restoreInboxDisposition(repository, request)),
    loadHistory: () => ({
      scans: repository.listScanHistory(20),
      lifecycle: repository.listFindingLifecycle()
    }),
    loadObservability: (scanId) => repository.getObservabilitySnapshot(scanId),
    processVaultEvents,
    synchronizeNoteSubjects,
    flush: () =>
      inboxPersistenceQueue.then(() => writeRuntime(input.adapter, input.databasePath, runtime)),
    close: () => runtime.close()
  };
}

const REVIEW_EVENT_KINDS: Record<
  Exclude<FindingTransition["kind"], "unchanged">,
  "finding-opened" | "finding-changed" | "finding-recurred" | "finding-resolved"
> = {
  new: "finding-opened",
  changed: "finding-changed",
  recurring: "finding-recurred",
  resolved: "finding-resolved"
};

function isSafeSubjectPath(path: string): boolean {
  return (
    path.length >= 1 &&
    path.length <= 1024 &&
    !/^[\\/]/.test(path) &&
    !/^[A-Za-z]:[\\/]/.test(path) &&
    !/(?:^|[\\/])\.{2}(?:[\\/]|$)/.test(path) &&
    !path.split("/").some((segment) => segment === "" || segment === ".") &&
    ![...path].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  );
}

function recordStageSpans(
  repository: VaultStewardRepository,
  scan: Parameters<PluginDatabase["saveCompletedScan"]>[0],
  correlationId: string
): void {
  const agentLatencyMs = scan.modelTraces.reduce((total, trace) => total + trace.latencyMs, 0);
  const retryCount = scan.modelTraces.reduce((total, trace) => total + trace.retries, 0);
  const stages: Array<{
    kind: import("../contracts/trace.js").TraceKind;
    attributes: Record<string, string | number | boolean>;
  }> = [
    { kind: "scanner", attributes: { fileCount: scan.files.length } },
    { kind: "parser", attributes: { parseProductCount: scan.parseProducts.length } },
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
    { kind: "finding", attributes: { findingCount: scan.findings.length } },
    { kind: "proposal", attributes: { notRun: true } },
    { kind: "apply", attributes: { notRun: true } }
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
