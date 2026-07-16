import { describe, expect, it } from "vitest";

import { DEFAULT_PLUGIN_SETTINGS, parsePluginSettings } from "../../src/plugin/settings.js";

describe("plugin settings", () => {
  it("uses safe defaults when persisted settings are absent or malformed", () => {
    expect(parsePluginSettings(undefined)).toEqual(DEFAULT_PLUGIN_SETTINGS);
    expect(parsePluginSettings({ vaultLabel: 12, autoScanOnLoad: "yes" })).toEqual(
      DEFAULT_PLUGIN_SETTINGS
    );
  });

  it("normalizes a selected-vault label and explicit auto-scan preference", () => {
    expect(parsePluginSettings({ vaultLabel: "  Personal notes  ", autoScanOnLoad: true })).toEqual(
      {
        vaultLabel: "Personal notes",
        autoScanOnLoad: true,
        modelProvider: DEFAULT_PLUGIN_SETTINGS.modelProvider,
        maintenanceSchedule: DEFAULT_PLUGIN_SETTINGS.maintenanceSchedule
      }
    );
  });

  it("requires a bounded loopback model provider configuration", () => {
    expect(
      parsePluginSettings({
        vaultLabel: "Notes",
        autoScanOnLoad: true,
        modelProvider: {
          kind: "ollama",
          endpoint: "http://127.0.0.1:11434",
          model: "llama3.1:8b",
          timeoutMs: 30_000,
          maxResponseBytes: 1_000_000
        }
      }).modelProvider
    ).toMatchObject({ kind: "ollama", model: "llama3.1:8b" });
    expect(
      parsePluginSettings({
        vaultLabel: "Notes",
        autoScanOnLoad: true,
        modelProvider: { kind: "ollama", endpoint: "https://example.com" }
      })
    ).toEqual(DEFAULT_PLUGIN_SETTINGS);
  });
});
