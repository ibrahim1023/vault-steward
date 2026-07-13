import { ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";

import { registerPluginCommands } from "./plugin/commands.js";
import {
  DEFAULT_PLUGIN_SETTINGS,
  parsePluginSettings,
  type PluginSettings
} from "./plugin/settings.js";

const STATUS_VIEW_TYPE = "vault-steward-status";

export default class VaultStewardPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_PLUGIN_SETTINGS;

  async onload(): Promise<void> {
    this.settings = parsePluginSettings(await this.loadData());
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

  private async openStatusView(): Promise<void> {
    const leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: STATUS_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}

class VaultStewardStatusItemView extends ItemView {
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
    this.contentEl.createEl("h2", { text: "Vault Steward" });
    this.contentEl.createEl("p", { text: `Current vault: ${this.plugin.settings.vaultLabel}` });
    this.contentEl.createEl("p", { text: "Ready to scan" });
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
  }
}
