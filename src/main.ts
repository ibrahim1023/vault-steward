import { ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { registerPluginCommands } from "./plugin/commands.js";
import { openPluginDatabase, type PluginDatabase } from "./plugin/database.js";
import { createGovernedIntegritySession, type GovernedIntegrityResult } from "./plugin/main.js";
import {
  DEFAULT_PLUGIN_SETTINGS,
  parsePluginSettings,
  type PluginSettings
} from "./plugin/settings.js";
import { ObsidianVaultReader, ObsidianVaultWriter } from "./vault-adapter/obsidian-reader.js";
import { createLocalProvider } from "./model-provider/local-provider.js";
import { AgentResultCache } from "./agents/coordinator.js";
import { proposeFix } from "./review/propose.js";
import { ReviewWorkflow, type ReviewAction } from "./review/workflow.js";
import { getPluginDatabasePath } from "./storage/sqlite-runtime.js";
import { VaultStewardWorkspace } from "./ui/VaultStewardWorkspace.js";
import { scanVaultFiles, type ScannedNote } from "./scanner/scan.js";
import {
  DEFAULT_POLICY_DRAFT,
  POLICY_STUDIO_PATH,
  previewPolicyDraft,
  validatePolicyStudioPath
} from "./policy/studio.js";
import { parsePolicy } from "./policy/parse.js";
import { explainFinding, type FindingExplanation } from "./agents/finding-explanation.js";
import { checkModelReadiness } from "./model-provider/readiness.js";
import type { Finding } from "./contracts/index.js";
import { validateReviewerFeedback, type FeedbackVerdict } from "./feedback/review.js";
import { analyzeChangeImpact, type ChangeImpact } from "./indexing/impact.js";
import {
  decideMaintenanceRun,
  nextScheduleState,
  type MaintenanceScheduleState
} from "./maintenance/scheduler.js";
import { configurationFingerprint } from "./observability/fingerprint.js";
import type { TracePreferences } from "./contracts/trace.js";

const STATUS_VIEW_TYPE = "vault-steward-status";

export default class VaultStewardPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;
  private vaultReader?: ObsidianVaultReader;
  private database: PluginDatabase | undefined;
  private readonly parsedNotes = new Map<string, ScannedNote>();
  private readonly agentResultCache = new AgentResultCache();
  private maintenanceState: MaintenanceScheduleState = { runsInWindow: 0, scanInProgress: false };
  private activeScan = false;

  async onload(): Promise<void> {
    this.settings = parsePluginSettings(await this.loadData());
    this.vaultReader = new ObsidianVaultReader(this.app.vault);
    this.database = await openPluginDatabase({
      adapter: this.app.vault.adapter,
      databasePath: getPluginDatabasePath(this.app.vault.configDir, this.manifest.id),
      locateFile: (file) =>
        this.app.vault.adapter.getResourcePath(`${this.pluginDirectory()}/${file}`)
    });
    this.register(this.vaultReader.watchInvalidations());
    this.registerEvent(this.app.vault.on("modify", () => this.recordMaintenanceEvent()));
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

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(STATUS_VIEW_TYPE);
    if (this.database) {
      await this.database.flush();
      this.database.close();
      this.database = undefined;
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
    const provider = createLocalProvider(this.settings.modelProvider);
    // Consume events here so a subsequent incremental worker can operate from a bounded batch.
    // The governed scan remains vault-wide: reference and semantic checks need global context.
    this.vaultReader.consumeInvalidatedEvents();
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
      retrievalTopK: 0
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
        bodyMetadataHash: hashMetadata({ headings: note.headings, references: note.references }),
        dependencies: note.references.map((reference) => ({
          targetPath: reference.rawTarget,
          relation: reference.kind
        }))
      })),
      findings: result.findings,
      modelTraces: result.modelTraces,
      traceConfiguration: { fingerprint: configHash, values: traceConfiguration }
    });
    await this.database.flush();
    return result;
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
    this.database.repository.saveProposal({
      id: result.proposal.id,
      findingId: result.proposal.findingId,
      patchJson: JSON.stringify(result.proposal),
      sourceRevisionsJson: "{}",
      status: "pending"
    });
    await this.database.flush();
    return {
      proposal: result.proposal,
      sources: { [sourcePath(result.proposal)]: source.content }
    };
  }

  async reviewProposal(proposalId: string, action: ReviewAction) {
    const record = this.database?.repository.findProposal(proposalId);
    if (!record || !this.database) throw new Error("Proposal is unavailable.");
    const proposal = JSON.parse(record.patchJson);
    new ReviewWorkflow(this.database.repository, new ObsidianVaultWriter(this.app.vault)).act(
      proposal,
      action,
      new Date().toISOString()
    );
    await this.database.flush();
  }

  async loadPolicyDraft(): Promise<string> {
    try {
      return await this.app.vault.adapter.read(POLICY_STUDIO_PATH);
    } catch {
      return DEFAULT_POLICY_DRAFT;
    }
  }

  async previewPolicyDraft(source: string) {
    if (this.parsedNotes.size === 0) {
      throw new Error("Run a completed scan before previewing a policy.");
    }
    return previewPolicyDraft(
      source,
      [...this.parsedNotes.values()].map((note) => ({
        path: note.path,
        frontmatter: note.frontmatter
      }))
    );
  }

  async savePolicyDraft(source: string): Promise<void> {
    const path = validatePolicyStudioPath(POLICY_STUDIO_PATH);
    if (!path.ok) throw new Error(path.diagnostic);
    if (!parsePolicy(source).ok) throw new Error("Policy draft is invalid.");
    if (!(await this.app.vault.adapter.exists(".vault-steward"))) {
      await this.app.vault.adapter.mkdir(".vault-steward");
    }
    await this.app.vault.adapter.write(POLICY_STUDIO_PATH, source);
  }

  async explainFinding(finding: Finding): Promise<FindingExplanation> {
    return explainFinding(createLocalProvider(this.settings.modelProvider), finding);
  }

  async checkModelReadiness() {
    return checkModelReadiness(createLocalProvider(this.settings.modelProvider));
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
      createdAt: new Date().toISOString()
    });
    await this.database.flush();
  }

  async applyProposal(proposalId: string) {
    const record = this.database?.repository.findProposal(proposalId);
    if (!record || !this.database) throw new Error("Proposal is unavailable.");
    const proposal = JSON.parse(record.patchJson);
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

  private pluginDirectory(): string {
    return this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
  }

  private async openStatusView(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: STATUS_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}

function hashMetadata(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sourcePath(proposal: { operations: Array<{ path: string }> }): string {
  return proposal.operations[0]?.path ?? "";
}

class VaultStewardStatusItemView extends ItemView {
  private root: Root | undefined;
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
    this.root = createRoot(this.contentEl);
    this.root.render(
      createElement(
        "div",
        undefined,
        createElement(VaultStewardWorkspace, {
          vaultLabel: this.plugin.settings.vaultLabel,
          scan: () => this.plugin.scanVault(),
          loadFindings: () => this.plugin.loadFindings(),
          loadHistory: () => this.plugin.loadHistory(),
          loadObservability: (scanId) => this.plugin.loadObservability(scanId),
          deleteScanTrace: (scanId) => this.plugin.deleteScanTrace(scanId),
          deleteAllTraceData: () => this.plugin.deleteAllTraceData(),
          createProposal: (findingId, target) =>
            this.plugin.createReferenceProposal(findingId, target),
          reviewProposal: (proposalId, action) => this.plugin.reviewProposal(proposalId, action),
          applyProposal: (proposalId) => this.plugin.applyProposal(proposalId),
          policyStudio: {
            loadDraft: () => this.plugin.loadPolicyDraft(),
            previewDraft: (source) => this.plugin.previewPolicyDraft(source),
            saveDraft: (source) => this.plugin.savePolicyDraft(source)
          },
          explainFinding: (finding) => this.plugin.explainFinding(finding),
          checkModelReadiness: () => this.plugin.checkModelReadiness(),
          submitFeedback: (finding, verdict, label) =>
            this.plugin.submitFeedback(finding, verdict, label),
          maintenance: {
            schedule: this.plugin.settings.maintenanceSchedule,
            state: this.plugin.getMaintenanceState(),
            setPaused: (paused) => this.plugin.setMaintenancePaused(paused)
          },
          inspectImpact: (path) => this.plugin.inspectImpact(path)
        })
      )
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
  }
}

class VaultStewardSettingsTab extends PluginSettingTab {
  constructor(
    app: VaultStewardPlugin["app"],
    private readonly plugin: VaultStewardPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Vault Steward settings" });

    new Setting(this.containerEl)
      .setName("Vault label")
      .setDesc("A local label shown in the Vault Steward status view.")
      .addText((text) =>
        text.setValue(this.plugin.settings.vaultLabel).onChange(async (value) => {
          await this.plugin.saveSettings({ ...this.plugin.settings, vaultLabel: value });
        })
      );

    new Setting(this.containerEl)
      .setName("Scan on load")
      .setDesc("Run one governed local scan when the plugin loads.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoScanOnLoad).onChange(async (value) => {
          await this.plugin.saveSettings({ ...this.plugin.settings, autoScanOnLoad: value });
        })
      );

    new Setting(this.containerEl)
      .setName("Local model endpoint")
      .setDesc("A loopback Ollama or llama.cpp-compatible endpoint required for governed scans.")
      .addText((text) =>
        text.setValue(this.plugin.settings.modelProvider.endpoint).onChange(async (endpoint) => {
          await this.plugin.saveSettings({
            ...this.plugin.settings,
            modelProvider: { ...this.plugin.settings.modelProvider, endpoint }
          });
        })
      );

    new Setting(this.containerEl)
      .setName("Local model")
      .setDesc("The installed local model used for required semantic analysis.")
      .addText((text) =>
        text.setValue(this.plugin.settings.modelProvider.model).onChange(async (model) => {
          await this.plugin.saveSettings({
            ...this.plugin.settings,
            modelProvider: { ...this.plugin.settings.modelProvider, model }
          });
        })
      );

    new Setting(this.containerEl)
      .setName("Scheduled maintenance")
      .setDesc("Run local maintenance scans while Obsidian is open. Disabled by default.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.maintenanceSchedule.enabled)
          .onChange(async (enabled) => {
            await this.plugin.saveSettings({
              ...this.plugin.settings,
              maintenanceSchedule: { ...this.plugin.settings.maintenanceSchedule, enabled }
            });
          })
      );

    new Setting(this.containerEl)
      .setName("Maintenance interval (minutes)")
      .setDesc("Minimum 5 minutes; scheduled scans never overlap an active scan.")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maintenanceSchedule.intervalMinutes))
          .onChange(async (value) => {
            const intervalMinutes = Number(value);
            if (
              !Number.isInteger(intervalMinutes) ||
              intervalMinutes < 5 ||
              intervalMinutes > 1_440
            )
              return;
            await this.plugin.saveSettings({
              ...this.plugin.settings,
              maintenanceSchedule: { ...this.plugin.settings.maintenanceSchedule, intervalMinutes }
            });
          })
      );

    new Setting(this.containerEl)
      .setName("Event-triggered maintenance")
      .setDesc("Coalesce vault changes before a scheduled local scan.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.maintenanceSchedule.eventTriggered)
          .onChange(async (eventTriggered) => {
            await this.plugin.saveSettings({
              ...this.plugin.settings,
              maintenanceSchedule: { ...this.plugin.settings.maintenanceSchedule, eventTriggered }
            });
          })
      );

    const tracePreferences = this.plugin.getTracePreferences();
    new Setting(this.containerEl)
      .setName("Trace retention (days)")
      .setDesc("Keep local metadata-only scan traces for 1 to 3650 days.")
      .addText((text) =>
        text.setValue(String(tracePreferences.retentionDays)).onChange(async (value) => {
          const retentionDays = Number(value);
          if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) return;
          await this.plugin.saveTracePreferences({
            ...this.plugin.getTracePreferences(),
            retentionDays
          });
        })
      );

    new Setting(this.containerEl)
      .setName("Store redacted prompt snapshots")
      .setDesc("Disabled by default. Rejected content is never stored.")
      .addToggle((toggle) =>
        toggle.setValue(tracePreferences.storePromptSnapshots).onChange(async (enabled) => {
          await this.plugin.saveTracePreferences({
            ...this.plugin.getTracePreferences(),
            storePromptSnapshots: enabled,
            redactExcerpts: true
          });
        })
      );

    new Setting(this.containerEl)
      .setName("Store redacted model-output snapshots")
      .setDesc("Disabled by default. Only bounded, redacted structured snapshots can be retained.")
      .addToggle((toggle) =>
        toggle.setValue(tracePreferences.storeModelOutputSnapshots).onChange(async (enabled) => {
          await this.plugin.saveTracePreferences({
            ...this.plugin.getTracePreferences(),
            storeModelOutputSnapshots: enabled,
            redactExcerpts: true
          });
        })
      );

    new Setting(this.containerEl)
      .setName("Excluded trace folders")
      .setDesc(
        "Comma-separated vault-relative folders. Folder contents are never stored as trace metadata."
      )
      .addText((text) =>
        text.setValue(tracePreferences.excludedFolders.join(", ")).onChange(async (value) => {
          const excludedFolders = value
            .split(",")
            .map((folder) => folder.trim())
            .filter(Boolean);
          await this.plugin.saveTracePreferences({
            ...this.plugin.getTracePreferences(),
            excludedFolders
          });
        })
      );
  }
}
