import { describe, expect, it } from "vitest";

import { HYPERFUSION_API_BASE_URL } from "../../src/model-provider/local-provider.js";
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
        cloudModelConsent: false,
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

  it("accepts only the fixed OpenAI origin and keeps cloud consent explicit", () => {
    const settings = parsePluginSettings({
      vaultLabel: "Notes",
      autoScanOnLoad: false,
      cloudModelConsent: true,
      modelProvider: {
        kind: "openai",
        endpoint: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        apiKey: "sk-test-key",
        timeoutMs: 30_000,
        maxResponseBytes: 1_000_000
      }
    });
    expect(settings.modelProvider).toMatchObject({ kind: "openai", model: "gpt-4o-mini" });
    expect(settings.cloudModelConsent).toBe(true);

    expect(
      parsePluginSettings({
        vaultLabel: "Notes",
        autoScanOnLoad: false,
        cloudModelConsent: true,
        modelProvider: { ...settings.modelProvider, endpoint: "https://example.com/v1" }
      })
    ).toEqual(DEFAULT_PLUGIN_SETTINGS);
  });

  it("accepts only the fixed HyperFusion origin and keeps cloud consent explicit", () => {
    const settings = parsePluginSettings({
      vaultLabel: "Notes",
      autoScanOnLoad: false,
      cloudModelConsent: true,
      modelProvider: {
        kind: "hyperfusion",
        endpoint: HYPERFUSION_API_BASE_URL,
        model: "qwen/qwen3-32b",
        apiKey: "hf-test-key",
        timeoutMs: 30_000,
        maxResponseBytes: 1_000_000
      }
    });
    expect(settings.modelProvider).toMatchObject({
      kind: "hyperfusion",
      model: "qwen/qwen3-32b"
    });
    expect(settings.cloudModelConsent).toBe(true);

    expect(
      parsePluginSettings({
        vaultLabel: "Notes",
        autoScanOnLoad: false,
        cloudModelConsent: true,
        modelProvider: { ...settings.modelProvider, endpoint: "https://example.com/v1" }
      })
    ).toEqual(DEFAULT_PLUGIN_SETTINGS);
  });
});
