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

const STATUS_VIEW_TYPE = "vault-steward-status";

export default class VaultStewardPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;
  private vaultReader?: ObsidianVaultReader;
  private database: PluginDatabase | undefined;
  private readonly parsedNotes = new Map<string, ScannedNote>();
  private readonly agentResultCache = new AgentResultCache();

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
    if (!this.vaultReader) throw new Error("Vault reader is unavailable.");
    if (!this.database) throw new Error("Vault Steward database is unavailable.");
    const provider = createLocalProvider(this.settings.modelProvider);
    // Consume events here so a subsequent incremental worker can operate from a bounded batch.
    // The governed scan remains vault-wide: reference and semantic checks need global context.
    this.vaultReader.consumeInvalidatedEvents();
    const files = await this.vaultReader.listFiles();
    const snapshot = scanVaultFiles(files, this.parsedNotes);
    const startedAt = new Date().toISOString();
    const result = await createGovernedIntegritySession([provider], this.agentResultCache).scan(
      files,
      snapshot
    );
    this.parsedNotes.clear();
    for (const note of snapshot.notes) this.parsedNotes.set(note.path, note);
    this.database.saveCompletedScan({
      id: result.scanId,
      vaultFingerprint: this.app.vault.getName(),
      configHash: this.settings.modelProvider.model,
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
      modelTraces: result.modelTraces
    });
    await this.database.flush();
    return result;
  }

  loadFindings() {
    return this.database?.loadFindings() ?? [];
  }

  loadHistory() {
    return this.database?.loadHistory() ?? { scans: [], lifecycle: [] };
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
          createProposal: (findingId, target) =>
            this.plugin.createReferenceProposal(findingId, target),
          reviewProposal: (proposalId, action) => this.plugin.reviewProposal(proposalId, action),
          applyProposal: (proposalId) => this.plugin.applyProposal(proposalId)
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
  }
}
