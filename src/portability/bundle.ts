import type { PluginSettings } from "../plugin/settings.js";

export type PortableBundle = {
  schemaVersion: 1;
  settings: {
    vaultLabel: string;
    autoScanOnLoad: boolean;
    maintenanceSchedule: PluginSettings["maintenanceSchedule"];
    model: string;
  };
  policy: string;
  decisions: Array<{ proposalId: string; action: string; actedAt: string }>;
};
export function createPortableBundle(input: {
  settings: PluginSettings;
  policy: string;
  decisions: PortableBundle["decisions"];
}): PortableBundle {
  return {
    schemaVersion: 1,
    settings: {
      vaultLabel: input.settings.vaultLabel,
      autoScanOnLoad: input.settings.autoScanOnLoad,
      maintenanceSchedule: input.settings.maintenanceSchedule,
      model: input.settings.modelProvider.model
    },
    policy: input.policy,
    decisions: input.decisions
      .slice(0, 500)
      .map(({ proposalId, action, actedAt }) => ({ proposalId, action, actedAt }))
  };
}
export function parsePortableBundle(
  source: string
): { ok: true; value: PortableBundle } | { ok: false; diagnostics: string[] } {
  try {
    const value = JSON.parse(source) as Partial<PortableBundle>;
    if (
      value.schemaVersion !== 1 ||
      !value.settings ||
      typeof value.policy !== "string" ||
      !Array.isArray(value.decisions) ||
      value.policy.length > 32_768 ||
      value.decisions.length > 500
    )
      return { ok: false, diagnostics: ["Portable bundle is invalid."] };
    return { ok: true, value: value as PortableBundle };
  } catch {
    return { ok: false, diagnostics: ["Portable bundle is invalid JSON."] };
  }
}
