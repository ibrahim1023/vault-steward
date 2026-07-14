import { ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { registerPluginCommands } from "./plugin/commands.js";
import { createGovernedIntegritySession, type GovernedIntegrityResult } from "./plugin/main.js";
import {
  DEFAULT_PLUGIN_SETTINGS,
  parsePluginSettings,
  type PluginSettings
} from "./plugin/settings.js";
import { ObsidianVaultReader } from "./vault-adapter/obsidian-reader.js";
import { createLocalProvider } from "./model-provider/local-provider.js";
import { VaultStewardWorkspace } from "./ui/VaultStewardWorkspace.js";

const STATUS_VIEW_TYPE = "vault-steward-status";

export default class VaultStewardPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;
  private vaultReader?: ObsidianVaultReader;

  async onload(): Promise<void> {
    this.settings = parsePluginSettings(await this.loadData());
    this.vaultReader = new ObsidianVaultReader(this.app.vault);
    this.register(this.vaultReader.watchInvalidations());
    this.addSettingTab(new VaultStewardSettingsTab(this.app, this));
    this.registerView(STATUS_VIEW_TYPE, (leaf) => new VaultStewardStatusItemView(leaf, this));
    registerPluginCommands(this, () => this.openStatusView());
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(STATUS_VIEW_TYPE);
  }

  async saveSettings(nextSettings: PluginSettings): Promise<void> {
    this.settings = parsePluginSettings(nextSettings);
    await this.saveData(this.settings);
  }

  async scanVault(): Promise<GovernedIntegrityResult> {
    if (!this.vaultReader) throw new Error("Vault reader is unavailable.");
    const provider = createLocalProvider(this.settings.modelProvider);
    const files = await this.vaultReader.listFiles();
    return createGovernedIntegritySession([provider]).scan(files);
  }

  private async openStatusView(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: STATUS_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
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
          scan: () => this.plugin.scanVault()
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
      .setDesc(
        "Prepare Vault Steward to scan when the plugin loads. The scanner is added in a later task."
      )
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
