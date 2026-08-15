import {
  HYPERFUSION_API_BASE_URL,
  isValidModelProviderConfig,
  OPENAI_API_BASE_URL,
  type HyperFusionProviderConfig,
  type ModelProviderConfig,
  type OpenAIProviderConfig
} from "../model-provider/local-provider.js";
import {
  DEFAULT_MAINTENANCE_SCHEDULE,
  type MaintenanceSchedule
} from "../maintenance/scheduler.js";

export type PluginSettings = {
  vaultLabel: string;
  autoScanOnLoad: boolean;
  modelProvider: ModelProviderConfig;
  cloudModelConsents: Partial<Record<"openai" | "hyperfusion", boolean>>;
  maintenanceSchedule: MaintenanceSchedule;
  suppressedFindingPatterns: string[];
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  vaultLabel: "Current vault",
  autoScanOnLoad: false,
  cloudModelConsents: {},
  suppressedFindingPatterns: [],
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
  const vaultLabel = validVaultLabel(candidate.vaultLabel) ?? DEFAULT_PLUGIN_SETTINGS.vaultLabel;
  const autoScanOnLoad =
    typeof candidate.autoScanOnLoad === "boolean"
      ? candidate.autoScanOnLoad
      : DEFAULT_PLUGIN_SETTINGS.autoScanOnLoad;
  const modelProvider = isValidProviderConfig(candidate.modelProvider)
    ? candidate.modelProvider
    : DEFAULT_PLUGIN_SETTINGS.modelProvider;
  // Deliberately do not migrate the former shared acknowledgement: a consent
  // for one remote provider must never authorize another provider.
  const cloudModelConsents = validCloudModelConsents(candidate.cloudModelConsents);
  const maintenanceSchedule = candidate.maintenanceSchedule ?? DEFAULT_MAINTENANCE_SCHEDULE;
  const suppressedFindingPatterns = validSuppressionPatterns(candidate.suppressedFindingPatterns);
  return {
    vaultLabel,
    autoScanOnLoad,
    modelProvider,
    cloudModelConsents,
    suppressedFindingPatterns,
    maintenanceSchedule: isValidMaintenanceSchedule(maintenanceSchedule)
      ? maintenanceSchedule
      : DEFAULT_MAINTENANCE_SCHEDULE
  };
}

function validCloudModelConsents(value: unknown): PluginSettings["cloudModelConsents"] {
  if (value === null || typeof value !== "object") return {};
  const candidate = value as Record<string, unknown>;
  return {
    ...(candidate.openai === true ? { openai: true } : {}),
    ...(candidate.hyperfusion === true ? { hyperfusion: true } : {})
  };
}

function validSuppressionPatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))]
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 512)
    .slice(0, 100);
}

function validVaultLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 120 ? normalized : null;
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

function isValidProviderConfig(value: unknown): value is ModelProviderConfig {
  return isValidModelProviderConfig(value);
}

export function openAIProviderSettings(current: ModelProviderConfig): OpenAIProviderConfig {
  return current.kind === "openai"
    ? current
    : {
        kind: "openai",
        endpoint: OPENAI_API_BASE_URL,
        model: "gpt-4o-mini",
        apiKey: "",
        timeoutMs: current.timeoutMs,
        maxResponseBytes: current.maxResponseBytes
      };
}

export function hyperFusionProviderSettings(
  current: ModelProviderConfig
): HyperFusionProviderConfig {
  return current.kind === "hyperfusion"
    ? current
    : {
        kind: "hyperfusion",
        endpoint: HYPERFUSION_API_BASE_URL,
        model: "qwen/qwen3-32b",
        apiKey: "",
        timeoutMs: current.timeoutMs,
        maxResponseBytes: current.maxResponseBytes
      };
}
