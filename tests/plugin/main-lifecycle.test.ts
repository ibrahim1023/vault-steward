import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import VaultStewardPlugin from "../../src/main.js";

describe("plugin lifecycle and settings compatibility", () => {
  it("does not start a scan during Inbox persistence or review a finding during a scan", async () => {
    const saveInboxReview = vi.fn(async () => undefined);
    const scanVaultInternal = vi.fn(async () => ({ scanId: "scan-2", findings: [] }));
    const plugin = {
      activeScan: false,
      database: { hasPendingInboxActions: () => true, saveInboxReview },
      scanVaultInternal,
      maintenanceState: { scanInProgress: false }
    };
    await expect(
      VaultStewardPlugin.prototype.scanVault.call(plugin as unknown as VaultStewardPlugin)
    ).rejects.toThrow("Inbox decision");
    expect(scanVaultInternal).not.toHaveBeenCalled();
    plugin.activeScan = true;
    await expect(
      VaultStewardPlugin.prototype.reviewInbox.call(
        plugin as unknown as VaultStewardPlugin,
        ["occurrence"],
        "acknowledged"
      )
    ).rejects.toThrow("scan");
    expect(saveInboxReview).not.toHaveBeenCalled();
  });

  it("refuses approval and apply entry points while an Inbox write is pending", async () => {
    const findProposal = vi.fn();
    const plugin = {
      database: { hasPendingInboxActions: () => true, repository: { findProposal } }
    } as unknown as VaultStewardPlugin;
    await expect(
      VaultStewardPlugin.prototype.reviewProposal.call(plugin, "proposal", "approved")
    ).rejects.toThrow("Inbox decision");
    await expect(
      VaultStewardPlugin.prototype.applyProposal.call(plugin, "proposal")
    ).rejects.toThrow("Inbox decision");
    await expect(
      VaultStewardPlugin.prototype.applyPreparedRepairBatch.call(plugin, {} as never)
    ).rejects.toThrow("Inbox decision");
    expect(findProposal).not.toHaveBeenCalled();
  });

  it("does not start an Inbox review during an approval or apply transition", async () => {
    const saveInboxReview = vi.fn(async () => undefined);
    const plugin = {
      activeScan: false,
      activeReviewMutations: 1,
      database: { saveInboxReview }
    } as unknown as VaultStewardPlugin;
    await expect(
      VaultStewardPlugin.prototype.reviewInbox.call(plugin, ["occurrence"], "ignored")
    ).rejects.toThrow("review");
    expect(saveInboxReview).not.toHaveBeenCalled();
  });

  it("holds the review-write guard until another database mutation is flushed", async () => {
    let releaseFlush!: () => void;
    const saveInboxReview = vi.fn(async () => undefined);
    const plugin = {
      activeScan: false,
      activeReviewMutations: 0,
      database: {
        hasPendingInboxActions: () => false,
        repository: { setTracePreferences: vi.fn() },
        flush: () =>
          new Promise<void>((resolve) => {
            releaseFlush = resolve;
          }),
        saveInboxReview
      }
    };
    const pending = VaultStewardPlugin.prototype.saveTracePreferences.call(
      plugin as unknown as VaultStewardPlugin,
      {} as never
    );
    expect(plugin.activeReviewMutations).toBe(1);
    await expect(
      VaultStewardPlugin.prototype.reviewInbox.call(
        plugin as unknown as VaultStewardPlugin,
        ["occurrence"],
        "ignored"
      )
    ).rejects.toThrow("review");
    releaseFlush();
    await pending;
    expect(plugin.activeReviewMutations).toBe(0);
    expect(saveInboxReview).not.toHaveBeenCalled();
  });

  it("leaves user-positioned status leaves in place and closes its database asynchronously", async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    const detachLeavesOfType = vi.fn();
    const plugin = {
      app: { workspace: { detachLeavesOfType } },
      database: { flush, close }
    };

    const result = VaultStewardPlugin.prototype.onunload.call(plugin);

    expect(result).toBeUndefined();
    expect(detachLeavesOfType).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("awaits status-leaf revelation and avoids a manual settings heading", async () => {
    const source = await readFile(resolve(import.meta.dirname, "../../src/main.ts"), "utf8");

    expect(source).toContain("await this.app.workspace.revealLeaf(leaf)");
    expect(source).toContain("getSettingDefinitions(): SettingDefinitionItem[]");
    expect(source).not.toContain("display(): void");
  });
});
