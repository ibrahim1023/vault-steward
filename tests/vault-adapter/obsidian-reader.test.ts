import { describe, expect, it } from "vitest";

import {
  ObsidianVaultReader,
  type VaultEventSource,
  type VaultFileHandle
} from "../../src/vault-adapter/obsidian-reader.js";

class FakeVault implements VaultEventSource {
  readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(
    readonly files: VaultFileHandle[],
    private readonly contents: Map<string, string>
  ) {}

  getFiles(): VaultFileHandle[] {
    return this.files;
  }

  async read(file: VaultFileHandle): Promise<string> {
    return this.contents.get(file.path) ?? "";
  }

  setContent(path: string, content: string): void {
    this.contents.set(path, content);
  }

  on(
    event: string,
    callback: (...args: unknown[]) => void
  ): { event: string; callback: (...args: unknown[]) => void } {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
    return { event, callback };
  }

  offref(ref: { event: string; callback: (...args: unknown[]) => void }): void {
    this.listeners.set(
      ref.event,
      (this.listeners.get(ref.event) ?? []).filter((callback) => callback !== ref.callback)
    );
  }

  emit(event: string, ...args: unknown[]): void {
    for (const callback of this.listeners.get(event) ?? []) callback(...args);
  }
}

describe("ObsidianVaultReader", () => {
  it("reads local files with normalized paths and deterministic revision hashes", async () => {
    const vault = new FakeVault(
      [
        { path: "notes\\Home.md", extension: "md" },
        { path: "attachments/file.pdf", extension: "pdf" }
      ],
      new Map([["notes\\Home.md", "# Home"]])
    );
    const reader = new ObsidianVaultReader(vault);

    const files = await reader.listFiles();

    expect(files).toEqual([
      expect.objectContaining({ path: "attachments/file.pdf", content: "" }),
      expect.objectContaining({ path: "notes/Home.md", content: "# Home" })
    ]);
    expect(files[1]?.revision).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects traversal paths and honors cancellation before reading", async () => {
    const unsafeVault = new FakeVault([{ path: "../outside.md", extension: "md" }], new Map());
    await expect(new ObsidianVaultReader(unsafeVault).listFiles()).rejects.toThrow(
      "outside the active vault"
    );

    const controller = new AbortController();
    controller.abort();
    const safeVault = new FakeVault(
      [{ path: "Home.md", extension: "md" }],
      new Map([["Home.md", "# Home"]])
    );
    await expect(
      new ObsidianVaultReader(safeVault).listFiles(controller.signal)
    ).rejects.toMatchObject({
      name: "AbortError"
    });
  });

  it("tracks changed and renamed files until the scanner consumes the invalidation set", () => {
    const vault = new FakeVault(
      [{ path: "Home.md", extension: "md" }],
      new Map([["Home.md", "# Home"]])
    );
    const reader = new ObsidianVaultReader(vault);
    const stopWatching = reader.watchInvalidations();

    vault.emit("modify", { path: "Home.md", extension: "md" });
    vault.emit("rename", { path: "Renamed.md", extension: "md" }, "Home.md");

    expect(reader.consumeInvalidatedPaths()).toEqual(["Home.md", "Renamed.md"]);
    expect(reader.consumeInvalidatedPaths()).toEqual([]);

    stopWatching();
    vault.emit("delete", { path: "Renamed.md", extension: "md" });
    expect(reader.consumeInvalidatedPaths()).toEqual([]);
  });

  it("produces a new revision after a changed file is read again", async () => {
    const vault = new FakeVault(
      [{ path: "Home.md", extension: "md" }],
      new Map([["Home.md", "# First"]])
    );
    const reader = new ObsidianVaultReader(vault);

    const firstRevision = (await reader.listFiles())[0]?.revision;
    vault.setContent("Home.md", "# Second");
    const secondRevision = (await reader.listFiles())[0]?.revision;

    expect(secondRevision).not.toBe(firstRevision);
  });
});
