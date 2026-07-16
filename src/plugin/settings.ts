import { createLocalProvider, type LocalProviderConfig } from "../model-provider/local-provider.js";
import {
  DEFAULT_MAINTENANCE_SCHEDULE,
  type MaintenanceSchedule
} from "../maintenance/scheduler.js";

export type PluginSettings = {
  vaultLabel: string;
  autoScanOnLoad: boolean;
  modelProvider: LocalProviderConfig;
  maintenanceSchedule: MaintenanceSchedule;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  vaultLabel: "Current vault",
  autoScanOnLoad: false,
  maintenanceSchedule: DEFAULT_MAINTENANCE_SCHEDULE,
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
  const maintenanceSchedule = candidate.maintenanceSchedule ?? DEFAULT_MAINTENANCE_SCHEDULE;
  if (!isValidMaintenanceSchedule(maintenanceSchedule)) return DEFAULT_PLUGIN_SETTINGS;
  return {
    vaultLabel,
    autoScanOnLoad: candidate.autoScanOnLoad,
    modelProvider,
    maintenanceSchedule
  };
}

function isValidMaintenanceSchedule(value: unknown): value is MaintenanceSchedule {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<MaintenanceSchedule>;
  return (
    typeof candidate.enabled === "boolean" &&
    typeof candidate.eventTriggered === "boolean" &&
    typeof candidate.paused === "boolean" &&
    typeof candidate.intervalMinutes === "number" &&
    Number.isInteger(candidate.intervalMinutes) &&
    candidate.intervalMinutes >= 5 &&
    candidate.intervalMinutes <= 24 * 60 &&
    typeof candidate.debounceMinutes === "number" &&
    Number.isInteger(candidate.debounceMinutes) &&
    candidate.debounceMinutes >= 1 &&
    candidate.debounceMinutes <= 60 &&
    typeof candidate.maxRunsPerHour === "number" &&
    Number.isInteger(candidate.maxRunsPerHour) &&
    candidate.maxRunsPerHour >= 1 &&
    candidate.maxRunsPerHour <= 12
  );
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
