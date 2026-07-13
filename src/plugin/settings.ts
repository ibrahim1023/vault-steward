export type PluginSettings = {
  vaultLabel: string;
  autoScanOnLoad: boolean;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  vaultLabel: "Current vault",
  autoScanOnLoad: false
};

export function parsePluginSettings(value: unknown): PluginSettings {
  if (value === null || typeof value !== "object") return DEFAULT_PLUGIN_SETTINGS;

  const candidate = value as Partial<PluginSettings>;
  if (typeof candidate.vaultLabel !== "string" || typeof candidate.autoScanOnLoad !== "boolean") {
    return DEFAULT_PLUGIN_SETTINGS;
  }

  const vaultLabel = candidate.vaultLabel.trim();
  if (vaultLabel.length === 0 || vaultLabel.length > 120) return DEFAULT_PLUGIN_SETTINGS;

  return { vaultLabel, autoScanOnLoad: candidate.autoScanOnLoad };
}
