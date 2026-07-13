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
        autoScanOnLoad: true
      }
    );
  });
});
