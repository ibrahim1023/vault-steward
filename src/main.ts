import {
  ItemView,
  Plugin,
  PluginSettingTab,
  type SettingDefinitionItem,
  WorkspaceLeaf
} from "obsidian";
import { createHash } from "node:crypto";
import { render } from "preact";
import { createElement } from "react";

import { registerPluginCommands } from "./plugin/commands.js";
import { openPluginDatabase, type PluginDatabase } from "./plugin/database.js";
import { displayVaultName } from "./plugin/vault-label.js";
import { createGovernedIntegritySession, type GovernedIntegrityResult } from "./plugin/main.js";
import {
  DEFAULT_PLUGIN_SETTINGS,
  hyperFusionProviderSettings,
  openAIProviderSettings,
  parsePluginSettings,
  type PluginSettings
} from "./plugin/settings.js";
import { ObsidianVaultReader, ObsidianVaultWriter } from "./vault-adapter/obsidian-reader.js";
import { createModelProvider, type ModelProviderConfig } from "./model-provider/local-provider.js";
import { AgentResultCache } from "./agents/coordinator.js";
import { proposeFix } from "./review/propose.js";
import { parseProposal, proposalDigest } from "./contracts/proposal.js";
import { ReviewWorkflow, type ReviewAction } from "./review/workflow.js";
import { parsePreparedRepairBatch, type PreparedRepairBatch } from "./contracts/prepared-repair.js";
import {
  combinePreparedRepairs,
  prepareReferenceRepairBatch
} from "./review/prepare-repair-batch.js";
import { selectReferenceCandidateWithProviders } from "./review/reference-recommendation.js";
import { prepareTaskDecisionRepairBatch } from "./review/prepare-task-decision-batch.js";
import { prepareTemplateRepairBatch } from "./review/prepare-template-repair-batch.js";
import { selectTaskDecisionRepairWithProviders } from "./review/task-decision-recommendation.js";
import { getPluginDatabasePath } from "./storage/sqlite-runtime.js";
import { VaultStewardWorkspace } from "./ui/VaultStewardWorkspace.js";
import { scanVaultFiles, type ScannedNote, type ScanSnapshot } from "./scanner/scan.js";
import { DEFAULT_POLICY_DRAFT, POLICY_STUDIO_PATH } from "./policy/studio.js";
import { MAX_POLICY_BYTES, parsePolicy } from "./policy/parse.js";
import { explainFinding, type FindingExplanation } from "./agents/finding-explanation.js";
import { checkModelReadiness } from "./model-provider/readiness.js";
import type { Finding } from "./contracts/index.js";
import {
  dismissalReasonVerdict,
  validateReviewerFeedback,
  type FeedbackVerdict
} from "./feedback/review.js";
import { findingFeedbackPattern } from "./feedback/local-learning.js";
import { analyzeChangeImpact, type ChangeImpact } from "./indexing/impact.js";
import {
  decideMaintenanceRun,
  nextScheduleState,
  type MaintenanceScheduleState
} from "./maintenance/scheduler.js";
import { configurationFingerprint } from "./observability/fingerprint.js";
import { promptRegistryFingerprint } from "./observability/prompt-registry.js";
import type { TracePreferences } from "./contracts/trace.js";
import { buildContextualNormalizationFindings } from "./reference/normalization.js";

import { buildDuplicateEntityReview } from "./review/entity-duplicate-review.js";
import {
  recommendCanonicalEntity as recommendCanonicalEntityWithProvider,
  selectCanonicalEntityWithProviders
} from "./review/entity-canonical-recommendation.js";
import { prepareEntityConsolidation } from "./review/entity-consolidation.js";
import { buildChangeAwareFindings } from "./maintenance/change-aware.js";
import { planIncrementalScan } from "./indexing/plan.js";

const STATUS_VIEW_TYPE = "vault-steward-status";
declare const __SQLITE_WASM_BASE64__: string;

export default class VaultStewardPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;
  private vaultReader?: ObsidianVaultReader;
  private database: PluginDatabase | undefined;
  private readonly parsedNotes = new Map<string, ScannedNote>();
  private activeSnapshot?: ScanSnapshot;
  private recentRenames: Array<{ oldPath: string; path: string }> = [];
  private readonly agentResultCache = new AgentResultCache();
  private maintenanceState: MaintenanceScheduleState = { runsInWindow: 0, scanInProgress: false };
  private activeScan = false;

  async onload(): Promise<void> {
    this.settings = parsePluginSettings(await this.loadData());
    this.vaultReader = new ObsidianVaultReader(this.app.vault);
    const wasmBinary = embeddedSqliteWasmBinary();
    this.database = await openPluginDatabase({
      adapter: this.app.vault.adapter,
      databasePath: getPluginDatabasePath(this.app.vault.configDir, this.manifest.id),
      ...(wasmBinary
        ? { wasmBinary }
        : {
            locateFile: (file: string) =>
              this.app.vault.adapter.getResourcePath(`${this.pluginDirectory()}/${file}`)
          })
    });
    this.register(this.vaultReader.watchInvalidations());
    this.registerEvent(this.app.vault.on("create", () => this.recordMaintenanceEvent()));
    this.registerEvent(this.app.vault.on("modify", () => this.recordMaintenanceEvent()));
    this.registerEvent(this.app.vault.on("delete", () => this.recordMaintenanceEvent()));
    this.registerEvent(this.app.vault.on("rename", () => this.recordMaintenanceEvent()));
    this.registerInterval(window.setInterval(() => void this.runMaintenanceTick(), 60_000));
    this.addSettingTab(new VaultStewardSettingsTab(this.app, this));
    this.registerView(STATUS_VIEW_TYPE, (leaf) => new VaultStewardStatusItemView(leaf, this));
    registerPluginCommands(this, () => this.openStatusView());
    this.addRibbonIcon("shield-check", "Open Vault Steward", () => {
      void this.openStatusView();
    });
    if (this.settings.autoScanOnLoad) {
      this.registerInterval(
        window.setTimeout(() => {
          void this.scanVault().catch(() => undefined);
        }, 0)
      );
    }
  }

  onunload(): void {
    const database = this.database;
    this.database = undefined;
    if (database) {
      void database
        .flush()
        .catch(() => undefined)
        .finally(() => database.close());
    }
  }

  async saveSettings(nextSettings: PluginSettings): Promise<void> {
    this.settings = parsePluginSettings(nextSettings);
    this.agentResultCache.clear();
    await this.saveData(this.settings);
  }

  async scanVault(): Promise<GovernedIntegrityResult> {
    if (this.activeScan) throw new Error("A vault scan is already running.");
    this.activeScan = true;
    try {
      return await this.scanVaultInternal();
    } finally {
      this.activeScan = false;
      this.maintenanceState = { ...this.maintenanceState, scanInProgress: false };
    }
  }

  private async scanVaultInternal(): Promise<GovernedIntegrityResult> {
    if (!this.vaultReader) throw new Error("Vault reader is unavailable.");
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    const provider = this.createSelectedModelProvider();
    // Consume events here so a subsequent incremental worker can operate from a bounded batch.
    // The governed scan remains vault-wide: reference and semantic checks need global context.
    const events = this.vaultReader.consumeInvalidatedEvents();
    if (events.length > 0) {
      const scanPlan = planIncrementalScan(events, { maxEvents: 50 });
      this.maintenanceState = {
        ...this.maintenanceState,
        lastPlanMode: scanPlan.mode,
        lastPlanReason: scanPlan.reasons.join(", ")
      };
    }
    const previousNotes = [...this.parsedNotes.values()];
    const files = await this.vaultReader.listFiles();
    const snapshot = scanVaultFiles(files, this.parsedNotes);
    const policySource = await this.loadPolicyDraft();
    const parsedPolicy = parsePolicy(policySource);
    if (!parsedPolicy.ok) throw new Error("The active policy file is invalid.");
    const traceConfiguration = {
      pluginVersion: this.manifest.version,
      parser: "scanner-v1",
      provider: this.settings.modelProvider.kind,
      model: this.settings.modelProvider.model,
      policyId: parsedPolicy.value.id,
      policyVersion: parsedPolicy.value.version,
      retrievalTopK: 0,
      agentBundleHash: promptRegistryFingerprint()
    };
    const configHash = configurationFingerprint(traceConfiguration);
    const startedAt = new Date().toISOString();
    const result = await createGovernedIntegritySession([provider], this.agentResultCache).scan(
      files,
      snapshot,
      [parsedPolicy.value]
    );
    this.parsedNotes.clear();
    for (const note of snapshot.notes) this.parsedNotes.set(note.path, note);
    this.activeSnapshot = snapshot;
    this.recentRenames = events.flatMap((event) =>
      event.kind === "rename" && event.oldPath ? [{ oldPath: event.oldPath, path: event.path }] : []
    );
    const normalizationFindings = buildContextualNormalizationFindings(
      snapshot,
      this.recentRenames.map((rename, index) => ({
        schemaVersion: 1,
        kind: "verified-rename",
        contextId: `${snapshot.id}:rename:${index}`,
        oldPath: rename.oldPath,
        targetPath: rename.path
      }))
    );
    const maintenanceFindings = buildChangeAwareFindings({
      scanId: snapshot.id,
      events,
      previousNotes,
      snapshot
    });
    const completedResult: GovernedIntegrityResult = {
      ...result,
      findings: [...result.findings, ...normalizationFindings, ...maintenanceFindings]
    };
    this.database.saveCompletedScan({
      id: result.scanId,
      vaultFingerprint: this.app.vault.getName(),
      configHash,
      inputHash: files.map((file) => `${file.path}:${file.revision}`).join("|"),
      parserVersion: "scanner-v1",
      startedAt,
      finishedAt: new Date().toISOString(),
      files,
      parseProducts: snapshot.notes.map((note) => ({
        path: note.path,
        revisionHash: note.revision,
        frontmatterHash: hashMetadata(note.frontmatter),
        bodyMetadataHash: hashMetadata({
          headings: note.headings,
          blockIds: note.blockIds,
          references: note.references
        }),
        dependencies: note.references.map((reference) => ({
          targetPath: reference.rawTarget,
          relation: reference.kind
        }))
      })),
      findings: completedResult.findings,
      modelTraces: result.modelTraces,
      traceConfiguration: { fingerprint: configHash, values: traceConfiguration }
    });
    await this.database.flush();
    return completedResult;
  }

  getMaintenanceState(): MaintenanceScheduleState {
    return { ...this.maintenanceState, scanInProgress: this.activeScan };
  }

  inspectImpact(path: string): ChangeImpact {
    return analyzeChangeImpact(
      { kind: "delete", path },
      { id: "active", notes: [...this.parsedNotes.values()] }
    );
  }

  async setMaintenancePaused(paused: boolean): Promise<void> {
    await this.saveSettings({
      ...this.settings,
      maintenanceSchedule: { ...this.settings.maintenanceSchedule, paused }
    });
  }

  private recordMaintenanceEvent(): void {
    if (!this.settings.maintenanceSchedule.eventTriggered) return;
    this.maintenanceState = nextScheduleState(
      this.settings.maintenanceSchedule,
      this.maintenanceState,
      Date.now(),
      false
    );
  }

  private async runMaintenanceTick(): Promise<void> {
    const now = Date.now();
    const state = { ...this.maintenanceState, scanInProgress: this.activeScan };
    const decision = decideMaintenanceRun(this.settings.maintenanceSchedule, state, now);
    if (!decision.run) return;
    this.maintenanceState = nextScheduleState(this.settings.maintenanceSchedule, state, now, true);
    try {
      await this.scanVault();
    } catch {
      // A scheduled run exposes its failure through the next workspace refresh, not a tight retry loop.
    } finally {
      this.maintenanceState = { ...this.maintenanceState, scanInProgress: false };
    }
  }

  loadFindings() {
    return this.database?.loadFindings() ?? [];
  }

  loadDuplicateEntityReview(finding: Finding) {
    return this.activeSnapshot ? buildDuplicateEntityReview(this.activeSnapshot, finding) : null;
  }

  async recommendCanonicalEntity(finding: Finding) {
    if (!this.activeSnapshot) throw new Error("Run Check vault before ranking duplicate notes.");
    return recommendCanonicalEntityWithProvider({
      finding,
      snapshot: this.activeSnapshot,
      selectCandidate: (request) =>
        selectCanonicalEntityWithProviders([this.createSelectedModelProvider()], request)
    });
  }

  async prepareEntityConsolidation(finding: Finding, candidateId: string) {
    if (!this.database || !this.activeSnapshot)
      throw new Error("Run Check vault before preparing duplicate consolidation.");
    const writer = new ObsidianVaultWriter(this.app.vault);
    const prepared = await prepareEntityConsolidation({
      snapshot: this.activeSnapshot,
      finding,
      intent: {
        schemaVersion: 1,
        kind: "select-canonical",
        scanId: this.activeSnapshot.id,
        findingId: finding.id,
        candidateId
      },
      activeFindingCount: this.loadFindings().filter((item) => item.status === "open").length,
      readSource: (path) => writer.read(path),
      persistProposal: (proposal) => {
        const existing = this.database!.repository.findProposal(proposal.id);
        if (existing) {
          const persisted = parseStoredProposal(existing.patchJson, existing.proposalDigest);
          if (
            existing.status === "pending" &&
            proposalDigest(persisted) === proposalDigest(proposal)
          )
            return;
          throw new Error("A previous proposal for this finding must be reviewed first.");
        }
        this.database!.repository.saveProposal({
          id: proposal.id,
          findingId: proposal.findingId,
          patchJson: JSON.stringify(proposal),
          sourceRevisionsJson: "{}",
          status: "pending",
          proposalDigest: proposalDigest(proposal)
        });
      }
    });
    await this.database.flush();
    return prepared;
  }

  loadHistory() {
    return this.database?.loadHistory() ?? { scans: [], lifecycle: [] };
  }

  loadObservability(scanId?: string) {
    return (
      this.database?.loadObservability(scanId) ?? {
        scanId: null,
        timeline: [],
        lineage: [],
        configuration: null,
        inventory: {
          spans: 0,
          agentExecutions: 0,
          findingLineage: 0,
          retentionDays: 30,
          categories: {
            promptSnapshots: { enabled: false, count: 0, bytes: 0 },
            modelOutputSnapshots: { enabled: false, count: 0, bytes: 0 }
          }
        },
        snapshots: [],
        metrics: {
          scanDurationMs: null,
          agentDurationMs: 0,
          p50ScanDurationMs: null,
          p95ScanDurationMs: null,
          parseFailures: 0,
          indexFailures: 0,
          retrievalFailures: 0,
          validationFailures: 0,
          cacheHitRate: null,
          queueDepth: 0,
          databaseBytes: 0,
          modelLoadTimeMs: null,
          tokenUsage: 0,
          retries: 0,
          incompleteRate: 0,
          staleProposals: 0,
          applyFailures: 0
        }
      }
    );
  }

  getTracePreferences(): TracePreferences {
    return (
      this.database?.repository.getTracePreferences() ?? {
        retentionDays: 30,
        storePromptSnapshots: false,
        storeModelOutputSnapshots: false,
        redactExcerpts: true,
        excludedFolders: []
      }
    );
  }

  async saveTracePreferences(preferences: TracePreferences): Promise<void> {
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    this.database.repository.setTracePreferences(preferences, new Date().toISOString());
    await this.database.flush();
  }

  async deleteScanTrace(scanId: string): Promise<void> {
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    this.database.repository.deleteTraceForScan(
      scanId,
      new Date().toISOString(),
      crypto.randomUUID()
    );
    await this.database.flush();
  }

  async deleteAllTraceData(): Promise<void> {
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    this.database.repository.deleteAllTraceData(new Date().toISOString(), crypto.randomUUID());
    await this.database.flush();
  }

  async createReferenceProposal(findingId: string, target: string) {
    const finding = this.loadFindings().find((item) => item.id === findingId);
    if (!finding || !this.database) throw new Error("Finding is unavailable.");
    const writer = new ObsidianVaultWriter(this.app.vault);
    const source = await writer.read(finding.evidence[0]?.notePath ?? "");
    const result = proposeFix(
      finding,
      { path: finding.evidence[0]?.notePath ?? "", ...source },
      target
    );
    if (!result.applicable) throw new Error(result.reason);
    const parsed = parseProposal(result.proposal);
    if (!parsed.ok) throw new Error("Generated proposal is invalid.");
    this.database.repository.saveProposal({
      id: result.proposal.id,
      findingId: result.proposal.findingId,
      patchJson: JSON.stringify(result.proposal),
      sourceRevisionsJson: "{}",
      status: "pending",
      proposalDigest: proposalDigest(parsed.value)
    });
    await this.database.flush();
    return {
      proposal: result.proposal,
      sources: { [sourcePath(result.proposal)]: source.content }
    };
  }

  async prepareRecommendedRepairBatch() {
    if (!this.database || !this.activeSnapshot)
      throw new Error("Run Check vault before preparing repairs.");
    const findings = this.loadFindings();

    const provider = this.createSelectedModelProvider();
    const writer = new ObsidianVaultWriter(this.app.vault);
    const referencePrepared = await prepareReferenceRepairBatch({
      snapshot: this.activeSnapshot,
      findings,
      renames: this.recentRenames,
      readSource: (path) => writer.read(path),
      selectCandidate: (request) => selectReferenceCandidateWithProviders([provider], request),
      persistProposal: (proposal) => {
        const existing = this.database!.repository.findProposal(proposal.id);
        if (existing) {
          const persisted = parseStoredProposal(existing.patchJson, existing.proposalDigest);
          if (
            existing.status === "pending" &&
            proposalDigest(persisted) === proposalDigest(proposal)
          )
            return;
          throw new Error("A previous proposal for this finding must be reviewed first.");
        }
        this.database!.repository.saveProposal({
          id: proposal.id,
          findingId: proposal.findingId,
          patchJson: JSON.stringify(proposal),
          sourceRevisionsJson: "{}",
          status: "pending",
          proposalDigest: proposalDigest(proposal)
        });
      }
    });
    const taskDecisionPrepared = await prepareTaskDecisionRepairBatch({
      snapshot: this.activeSnapshot,
      findings,
      readSource: (path) => writer.read(path),
      selectIntent: (request) => selectTaskDecisionRepairWithProviders([provider], request),
      persistProposal: (proposal) => {
        const existing = this.database!.repository.findProposal(proposal.id);
        if (existing) {
          const persisted = parseStoredProposal(existing.patchJson, existing.proposalDigest);
          if (
            existing.status === "pending" &&
            proposalDigest(persisted) === proposalDigest(proposal)
          )
            return;
          throw new Error("A previous proposal for this finding must be reviewed first.");
        }
        this.database!.repository.saveProposal({
          id: proposal.id,
          findingId: proposal.findingId,
          patchJson: JSON.stringify(proposal),
          sourceRevisionsJson: "{}",
          status: "pending",
          proposalDigest: proposalDigest(proposal)
        });
      }
    });
    const templatePrepared = await prepareTemplateRepairBatch({
      snapshot: this.activeSnapshot,
      findings,
      readSource: (path) => writer.read(path),
      persistProposal: (proposal) => {
        const existing = this.database!.repository.findProposal(proposal.id);
        if (existing) return;
        this.database!.repository.saveProposal({
          id: proposal.id,
          findingId: proposal.findingId,
          patchJson: JSON.stringify(proposal),
          sourceRevisionsJson: "{}",
          status: "pending",
          proposalDigest: proposalDigest(proposal)
        });
      }
    });
    const prepared = combinePreparedRepairs(
      this.activeSnapshot.id,
      findings.filter((finding) => finding.status === "open").length,
      [referencePrepared, taskDecisionPrepared, templatePrepared]
    );
    await this.database.flush();
    return prepared;
  }

  async reviewProposal(proposalId: string, action: ReviewAction) {
    const record = this.database?.repository.findProposal(proposalId);
    if (!record || !this.database) throw new Error("Proposal is unavailable.");
    const proposal = parseStoredProposal(record.patchJson, record.proposalDigest);
    new ReviewWorkflow(this.database.repository, new ObsidianVaultWriter(this.app.vault)).act(
      proposal,
      action,
      new Date().toISOString()
    );
    await this.database.flush();
  }

  async loadPolicyDraft(): Promise<string> {
    const stat = await this.app.vault.adapter.stat(POLICY_STUDIO_PATH);
    if (!stat) return DEFAULT_POLICY_DRAFT;
    if (stat.size > MAX_POLICY_BYTES)
      throw new Error("Policy file exceeds the configured size limit.");
    return this.app.vault.adapter.read(POLICY_STUDIO_PATH);
  }

  async explainFinding(finding: Finding): Promise<FindingExplanation> {
    return explainFinding(this.createSelectedModelProvider(), finding);
  }

  async checkModelReadiness() {
    return checkModelReadiness(this.createSelectedModelProvider());
  }

  async submitFeedback(finding: Finding, verdict: FeedbackVerdict, label: string): Promise<void> {
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    const diagnostic = validateReviewerFeedback({
      findingId: finding.id,
      verdict,
      ...(label ? { label } : {})
    });
    if (diagnostic) throw new Error(diagnostic);
    this.database.repository.saveReviewerFeedback({
      id: crypto.randomUUID(),
      findingId: finding.id,
      proposalId: null,
      verdict,
      label: label || null,
      patternKey: findingFeedbackPattern(finding),
      createdAt: new Date().toISOString()
    });
    await this.database.flush();
  }

  listReviewerFeedback() {
    return this.database?.repository.listReviewerFeedback() ?? [];
  }

  async suppressFindingPattern(pattern: string): Promise<void> {
    const normalized = pattern.trim();
    if (!normalized || normalized.length > 512)
      throw new Error("The suppression pattern is invalid.");
    await this.saveSettings({
      ...this.settings,
      suppressedFindingPatterns: [...this.settings.suppressedFindingPatterns, normalized]
    });
  }

  async applyProposal(proposalId: string) {
    const record = this.database?.repository.findProposal(proposalId);
    if (!record || !this.database) throw new Error("Proposal is unavailable.");
    const proposal = parseStoredProposal(record.patchJson, record.proposalDigest);
    const result = await new ReviewWorkflow(
      this.database.repository,
      new ObsidianVaultWriter(this.app.vault)
    ).apply(proposal, new Date().toISOString(), {
      onReindex: () => {
        void this.scanVault();
      }
    });
    await this.database.flush();
    return result;
  }

  async applyPreparedRepairBatch(batch: PreparedRepairBatch) {
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    const parsedBatch = parsePreparedRepairBatch(batch);
    if (!parsedBatch.ok) throw new Error("Prepared repair batch is invalid.");
    const proposals = parsedBatch.value.proposalIds.map((proposalId, index) => {
      const record = this.database!.repository.findProposal(proposalId);
      if (!record) throw new Error("A prepared proposal is unavailable.");
      const proposal = parseStoredProposal(record.patchJson, record.proposalDigest);
      if (
        proposal.scanId !== parsedBatch.value.scanId ||
        proposal.findingId !== parsedBatch.value.findingIds[index]
      )
        throw new Error("Prepared repair batch integrity validation failed.");
      return proposal;
    });
    const result = await new ReviewWorkflow(
      this.database.repository,
      new ObsidianVaultWriter(this.app.vault)
    ).approveAndApplyBatch(proposals, new Date().toISOString(), {
      onReindex: async () => {
        await this.scanVault();
      }
    });
    await this.database.flush();
    return result;
  }

  async openVaultNote(path: string): Promise<void> {
    await this.app.workspace.openLinkText(path, "", false);
  }

  openProviderSettings(): void {
    const settings = (
      this.app as unknown as {
        setting: { open(): void; openTabById(id: string): void };
      }
    ).setting;
    settings.open();
    settings.openTabById(this.manifest.id);
  }

  private pluginDirectory(): string {
    return this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
  }

  private createSelectedModelProvider() {
    if (
      isCloudProvider(this.settings.modelProvider.kind) &&
      !this.settings.cloudModelConsents[this.settings.modelProvider.kind]
    ) {
      throw new Error(
        `${cloudProviderLabel(this.settings.modelProvider.kind)} access requires acknowledgement that selected vault evidence is sent to ${cloudProviderLabel(this.settings.modelProvider.kind)}.`
      );
    }
    return createModelProvider(this.settings.modelProvider);
  }

  private async openStatusView(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: STATUS_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}

function embeddedSqliteWasmBinary(): ArrayBuffer | undefined {
  if (typeof __SQLITE_WASM_BASE64__ !== "string") return undefined;
  return Uint8Array.from(Buffer.from(__SQLITE_WASM_BASE64__, "base64")).buffer;
}

function isCloudProvider(kind: ModelProviderConfig["kind"]): kind is "openai" | "hyperfusion" {
  return kind === "openai" || kind === "hyperfusion";
}

function cloudProviderLabel(kind: "openai" | "hyperfusion"): "OpenAI" | "HyperFusion" {
  return kind === "openai" ? "OpenAI" : "HyperFusion";
}

function hashMetadata(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sourcePath(proposal: { operations: Array<{ path: string }> }): string {
  return proposal.operations[0]?.path ?? "";
}

function parseStoredProposal(source: string, expectedDigest: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("Proposal integrity validation failed.");
  }
  const parsed = parseProposal(raw);
  if (!parsed.ok || proposalDigest(parsed.value) !== expectedDigest) {
    throw new Error("Proposal integrity validation failed.");
  }
  return parsed.value;
}

class VaultStewardStatusItemView extends ItemView {
  private mounted = false;
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: VaultStewardPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return STATUS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Vault Steward";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    render(
      createElement(
        "div",
        undefined,
        createElement(VaultStewardWorkspace, {
          vaultLabel: displayVaultName(
            this.plugin.app.vault.getName(),
            this.plugin.settings.vaultLabel
          ),
          scan: () => this.plugin.scanVault(),
          loadFindings: () => this.plugin.loadFindings(),
          loadHistory: () => this.plugin.loadHistory(),
          prepareRepairs: () => this.plugin.prepareRecommendedRepairBatch(),
          applyRepairs: (batch) => this.plugin.applyPreparedRepairBatch(batch),
          openNote: (path) => this.plugin.openVaultNote(path),
          markNotImportant: (finding, reason) =>
            this.plugin.submitFeedback(finding, dismissalReasonVerdict(reason), reason),
          loadDuplicateEntityReview: (finding) => this.plugin.loadDuplicateEntityReview(finding),
          recommendCanonicalEntity: (finding) => this.plugin.recommendCanonicalEntity(finding),
          prepareEntityConsolidation: (finding, candidateId) =>
            this.plugin.prepareEntityConsolidation(finding, candidateId),
          openProviderSettings: () => this.plugin.openProviderSettings(),
          diagnostics: {
            checkConnection: () => this.plugin.checkModelReadiness(),
            maintenance: {
              schedule: this.plugin.settings.maintenanceSchedule,
              state: this.plugin.getMaintenanceState(),
              setPaused: (paused) => this.plugin.setMaintenancePaused(paused)
            },
            loadFeedback: () => this.plugin.listReviewerFeedback(),
            suppressedPatterns: this.plugin.settings.suppressedFindingPatterns,
            suppressPattern: (pattern) => this.plugin.suppressFindingPattern(pattern),
            deleteDiagnosticTraces: () => this.plugin.deleteAllTraceData()
          }
        })
      ),
      this.contentEl
    );
    this.mounted = true;
  }

  async onClose(): Promise<void> {
    if (this.mounted) render(null, this.contentEl);
    this.mounted = false;
  }
}

class VaultStewardSettingsTab extends PluginSettingTab {
  constructor(
    app: VaultStewardPlugin["app"],
    private readonly plugin: VaultStewardPlugin
  ) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const provider = this.plugin.settings.modelProvider;
    const cloudProviderKind =
      provider.kind === "openai" || provider.kind === "hyperfusion" ? provider.kind : null;
    const cloud = cloudProviderKind !== null;
    const providerName = cloudProviderKind ? cloudProviderLabel(cloudProviderKind) : "";
    return [
      {
        name: "Vault label fallback",
        desc: "Used only when Obsidian cannot provide the active vault name.",
        control: { type: "text", key: "vaultLabel" }
      },
      {
        name: "Scan on load",
        desc: "Run one governed local scan when the plugin loads.",
        control: { type: "toggle", key: "autoScanOnLoad" }
      },
      {
        name: "Model provider",
        desc: "Ollama keeps analysis local. Cloud providers receive bounded selected evidence after acknowledgement.",
        control: {
          type: "dropdown",
          key: "providerKind",
          options: {
            ollama: "Ollama (local)",
            "llama.cpp": "llama.cpp (local)",
            hyperfusion: "HyperFusion (cloud, experimental)",
            openai: "OpenAI"
          }
        }
      },
      {
        name: cloud ? `${providerName} model` : "Local model",
        desc: cloud
          ? `The ${providerName} model used for required semantic analysis.`
          : "The installed local model used for required semantic analysis.",
        control: { type: "text", key: "providerModel" }
      },
      {
        name: "Local model endpoint",
        desc: "A loopback Ollama or llama.cpp-compatible endpoint required for governed scans.",
        visible: !cloud,
        control: { type: "text", key: "localEndpoint" }
      },
      {
        name: `${providerName} API key`,
        desc: `Stored locally in this vault's plugin data and used only for ${providerName} API requests.`,
        visible: cloud,
        control: { type: "text", key: "cloudApiKey" }
      },
      {
        name: `Allow ${providerName} to receive selected vault evidence`,
        desc: `Required. ${providerName} analysis is remote and can send bounded note excerpts to ${providerName}.`,
        visible: cloud,
        control: { type: "toggle", key: "cloudAcknowledgement" }
      },
      {
        name: "Scheduled maintenance",
        desc: "Run local maintenance scans while Obsidian is open. Disabled by default.",
        control: { type: "toggle", key: "maintenanceEnabled" }
      },
      {
        name: "Maintenance interval (minutes)",
        desc: "Minimum 5 minutes; scheduled scans never overlap an active scan.",
        control: {
          type: "number",
          key: "maintenanceInterval",
          validate: (value) =>
            Number.isInteger(value) && value >= 5 && value <= 1_440
              ? undefined
              : "Enter a whole number from 5 to 1440."
        }
      },
      {
        name: "Event-triggered maintenance",
        desc: "Coalesce vault changes before a scheduled local scan.",
        control: { type: "toggle", key: "maintenanceEventTriggered" }
      },
      {
        name: "Trace retention (days)",
        desc: "Keep local metadata-only scan traces for 1 to 3650 days.",
        control: {
          type: "number",
          key: "traceRetentionDays",
          validate: (value) =>
            Number.isInteger(value) && value >= 1 && value <= 3650
              ? undefined
              : "Enter a whole number from 1 to 3650."
        }
      },
      {
        name: "Store redacted prompt snapshots",
        desc: "Disabled by default. Rejected content is never stored.",
        control: { type: "toggle", key: "tracePromptSnapshots" }
      },
      {
        name: "Store redacted model-output snapshots",
        desc: "Disabled by default. Only bounded, redacted structured snapshots can be retained.",
        control: { type: "toggle", key: "traceModelOutputSnapshots" }
      },
      {
        name: "Excluded trace folders",
        desc: "Comma-separated vault-relative folders. Folder contents are never stored as trace metadata.",
        control: { type: "text", key: "traceExcludedFolders" }
      }
    ];
  }

  getControlValue(key: string): unknown {
    const settings = this.plugin.settings;
    const trace = this.plugin.getTracePreferences();
    switch (key) {
      case "vaultLabel":
        return settings.vaultLabel;
      case "autoScanOnLoad":
        return settings.autoScanOnLoad;
      case "providerKind":
        return settings.modelProvider.kind;
      case "providerModel":
        return settings.modelProvider.model;
      case "localEndpoint":
        return "apiKey" in settings.modelProvider ? "" : settings.modelProvider.endpoint;
      case "cloudApiKey":
        return "apiKey" in settings.modelProvider ? settings.modelProvider.apiKey : "";
      case "cloudAcknowledgement":
        return (
          isCloudProvider(settings.modelProvider.kind) &&
          Boolean(settings.cloudModelConsents[settings.modelProvider.kind])
        );
      case "maintenanceEnabled":
        return settings.maintenanceSchedule.enabled;
      case "maintenanceInterval":
        return settings.maintenanceSchedule.intervalMinutes;
      case "maintenanceEventTriggered":
        return settings.maintenanceSchedule.eventTriggered;
      case "traceRetentionDays":
        return trace.retentionDays;
      case "tracePromptSnapshots":
        return trace.storePromptSnapshots;
      case "traceModelOutputSnapshots":
        return trace.storeModelOutputSnapshots;
      case "traceExcludedFolders":
        return trace.excludedFolders.join(", ");
      default:
        return undefined;
    }
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings;
    const trace = this.plugin.getTracePreferences();
    if (key === "vaultLabel" && typeof value === "string")
      return this.plugin.saveSettings({ ...settings, vaultLabel: value });
    if (key === "autoScanOnLoad" && typeof value === "boolean")
      return this.plugin.saveSettings({ ...settings, autoScanOnLoad: value });
    if (
      key === "providerKind" &&
      (value === "ollama" || value === "llama.cpp" || value === "hyperfusion" || value === "openai")
    ) {
      const current = settings.modelProvider;
      const modelProvider: ModelProviderConfig =
        value === "openai"
          ? openAIProviderSettings(current)
          : value === "hyperfusion"
            ? hyperFusionProviderSettings(current)
            : "apiKey" in current
              ? {
                  kind: value,
                  endpoint: "http://127.0.0.1:11434",
                  model: "llama3.1:8b",
                  timeoutMs: current.timeoutMs,
                  maxResponseBytes: current.maxResponseBytes
                }
              : {
                  kind: value,
                  endpoint: current.endpoint,
                  model: current.model,
                  timeoutMs: current.timeoutMs,
                  maxResponseBytes: current.maxResponseBytes
                };
      await this.plugin.saveSettings({ ...settings, modelProvider });
      this.update();
      return;
    }
    if (key === "providerModel" && typeof value === "string")
      return this.plugin.saveSettings({
        ...settings,
        modelProvider: { ...settings.modelProvider, model: value }
      });
    if (
      key === "localEndpoint" &&
      typeof value === "string" &&
      !("apiKey" in settings.modelProvider)
    )
      return this.plugin.saveSettings({
        ...settings,
        modelProvider: { ...settings.modelProvider, endpoint: value }
      });
    if (key === "cloudApiKey" && typeof value === "string" && "apiKey" in settings.modelProvider)
      return this.plugin.saveSettings({
        ...settings,
        modelProvider: { ...settings.modelProvider, apiKey: value }
      });
    if (
      key === "cloudAcknowledgement" &&
      typeof value === "boolean" &&
      isCloudProvider(settings.modelProvider.kind)
    )
      return this.plugin.saveSettings({
        ...settings,
        cloudModelConsents: { ...settings.cloudModelConsents, [settings.modelProvider.kind]: value }
      });
    if (key === "maintenanceEnabled" && typeof value === "boolean")
      return this.plugin.saveSettings({
        ...settings,
        maintenanceSchedule: { ...settings.maintenanceSchedule, enabled: value }
      });
    if (key === "maintenanceInterval" && typeof value === "number")
      return this.plugin.saveSettings({
        ...settings,
        maintenanceSchedule: { ...settings.maintenanceSchedule, intervalMinutes: value }
      });
    if (key === "maintenanceEventTriggered" && typeof value === "boolean")
      return this.plugin.saveSettings({
        ...settings,
        maintenanceSchedule: { ...settings.maintenanceSchedule, eventTriggered: value }
      });
    if (key === "traceRetentionDays" && typeof value === "number")
      return this.plugin.saveTracePreferences({ ...trace, retentionDays: value });
    if (key === "tracePromptSnapshots" && typeof value === "boolean")
      return this.plugin.saveTracePreferences({
        ...trace,
        storePromptSnapshots: value,
        redactExcerpts: true
      });
    if (key === "traceModelOutputSnapshots" && typeof value === "boolean")
      return this.plugin.saveTracePreferences({
        ...trace,
        storeModelOutputSnapshots: value,
        redactExcerpts: true
      });
    if (key === "traceExcludedFolders" && typeof value === "string")
      return this.plugin.saveTracePreferences({
        ...trace,
        excludedFolders: value
          .split(",")
          .map((folder) => folder.trim())
          .filter(Boolean)
      });
  }
}
