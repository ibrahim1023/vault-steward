import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("declarative settings registration", () => {
  it("registers every user-facing setting without imperative Setting rows", async () => {
    const source = await readFile(resolve(import.meta.dirname, "../../src/main.ts"), "utf8");

    for (const key of [
      "vaultLabel",
      "autoScanOnLoad",
      "providerKind",
      "providerModel",
      "localEndpoint",
      "cloudApiKey",
      "cloudAcknowledgement",
      "maintenanceEnabled",
      "maintenanceInterval",
      "maintenanceEventTriggered",
      "traceRetentionDays",
      "tracePromptSnapshots",
      "traceModelOutputSnapshots",
      "traceExcludedFolders"
    ])
      expect(source).toContain(`key: "${key}"`);

    expect(source).not.toContain("new Setting(");
  });
});
