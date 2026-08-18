import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import VaultStewardPlugin from "../../src/main.js";

describe("plugin lifecycle and settings compatibility", () => {
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
    expect(source).not.toContain('createEl("h2", { text: "Vault Steward settings" })');
  });
});
