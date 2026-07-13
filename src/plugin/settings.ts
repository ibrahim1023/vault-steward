import { createLocalProvider, type LocalProviderConfig } from "../model-provider/local-provider.js";

export type PluginSettings = {
  vaultLabel: string;
  autoScanOnLoad: boolean;
  modelProvider: LocalProviderConfig;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  vaultLabel: "Current vault",
  autoScanOnLoad: false,
  modelProvider: {
    kind: "ollama",
    endpoint: "http://127.0.0.1:11434",
    model: "llama3.1:8b",
    timeoutMs: 30_000,
    maxResponseBytes: 1_000_000
  }
};

export function parsePluginSettings(value: unknown): PluginSettings {
  if (value === null || typeof value !== "object") return DEFAULT_PLUGIN_SETTINGS;

  const candidate = value as Partial<PluginSettings>;
  if (typeof candidate.vaultLabel !== "string" || typeof candidate.autoScanOnLoad !== "boolean") {
    return DEFAULT_PLUGIN_SETTINGS;
  }

  const vaultLabel = candidate.vaultLabel.trim();
  if (vaultLabel.length === 0 || vaultLabel.length > 120) return DEFAULT_PLUGIN_SETTINGS;

  const modelProvider = candidate.modelProvider ?? DEFAULT_PLUGIN_SETTINGS.modelProvider;
  if (!isValidProviderConfig(modelProvider)) return DEFAULT_PLUGIN_SETTINGS;
  return { vaultLabel, autoScanOnLoad: candidate.autoScanOnLoad, modelProvider };
}

function isValidProviderConfig(value: unknown): value is LocalProviderConfig {
  if (
    value === null ||
    typeof value !== "object" ||
    !["ollama", "llama.cpp"].includes((value as Partial<LocalProviderConfig>).kind ?? "") ||
    typeof (value as Partial<LocalProviderConfig>).endpoint !== "string" ||
    typeof (value as Partial<LocalProviderConfig>).model !== "string" ||
    typeof (value as Partial<LocalProviderConfig>).timeoutMs !== "number" ||
    typeof (value as Partial<LocalProviderConfig>).maxResponseBytes !== "number"
  )
    return false;
  try {
    createLocalProvider(value as LocalProviderConfig);
    return true;
  } catch {
    return false;
  }
}
