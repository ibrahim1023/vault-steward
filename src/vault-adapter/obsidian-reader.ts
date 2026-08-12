import { createHash } from "node:crypto";

import type { VaultEvent } from "../contracts/incremental.js";
import type { WritableVault } from "../review/workflow.js";
import type { VaultFile, VaultReader } from "./types.js";
import { assertScanLimits, DEFAULT_SCAN_LIMITS, type ScanLimits } from "../scanner/limits.js";

export type VaultFileHandle = {
  path: string;
  extension: string;
  stat?: { size: number };
};

export type VaultEventRef = unknown;

export type VaultEventSource = {
  getFiles(): VaultFileHandle[];
  read(file: VaultFileHandle): Promise<string>;
  on(event: string, callback: (...args: unknown[]) => void): VaultEventRef;
  offref(ref: VaultEventRef): void;
};

export type WritableVaultEventSource = VaultEventSource & {
  modify(file: VaultFileHandle, content: string): Promise<void>;
  process?(file: VaultFileHandle, fn: (content: string) => string): Promise<string>;
};

export class ObsidianVaultReader implements VaultReader {
  private readonly invalidatedPaths = new Set<string>();
  private readonly invalidatedEvents: VaultEvent[] = [];

  constructor(
    private readonly vault: VaultEventSource,
    private readonly limits: ScanLimits = DEFAULT_SCAN_LIMITS
  ) {}

  async listFiles(signal?: AbortSignal): Promise<readonly VaultFile[]> {
    throwIfAborted(signal);
    const files: VaultFile[] = [];
    const handles = [...this.vault.getFiles()].sort((left, right) =>
      left.path.localeCompare(right.path)
    );
    if (handles.length > this.limits.maxFiles)
      throw new Error("vault exceeds configured processing limits");
    const paths = new Set<string>();
    let totalBytes = 0;

    for (const file of handles) {
      throwIfAborted(signal);
      const path = normalizeAndValidatePath(file.path);
      if (paths.has(path)) throw new Error("Vault path is ambiguous.");
      paths.add(path);
      const size = file.extension === "md" ? file.stat?.size : 0;
      if (size !== undefined) {
        if (size > this.limits.maxFileBytes || totalBytes + size > this.limits.maxTotalBytes)
          throw new Error("vault exceeds configured processing limits");
        totalBytes += size;
      }
      const content = file.extension === "md" ? await this.vault.read(file) : "";
      throwIfAborted(signal);
      files.push({ path, content, revision: revisionFor(path, content) });
    }
    assertScanLimits(files, this.limits);
    return files;
  }

  watchInvalidations(): () => void {
    const refs = [
      this.vault.on("create", (file) => this.invalidateFile(file, "create")),
      this.vault.on("modify", (file) => this.invalidateFile(file, "modify")),
      this.vault.on("delete", (file) => this.invalidateFile(file, "delete")),
      this.vault.on("rename", (file, oldPath) => {
        this.invalidateFile(file, "rename", typeof oldPath === "string" ? oldPath : undefined);
        if (typeof oldPath === "string") this.invalidatePath(oldPath);
      })
    ];

    return () => {
      for (const ref of refs) this.vault.offref(ref);
    };
  }

  consumeInvalidatedPaths(): string[] {
    const paths = [...this.invalidatedPaths].sort((left, right) => left.localeCompare(right));
    this.invalidatedPaths.clear();
    return paths;
  }

  consumeInvalidatedEvents(): VaultEvent[] {
    const events = [...this.invalidatedEvents];
    this.invalidatedEvents.length = 0;
    return events;
  }

  private invalidateFile(file: unknown, kind: VaultEvent["kind"], oldPath?: string): void {
    if (!isVaultFileHandle(file)) return;
    this.invalidatedEvents.push({
      schemaVersion: 1,
      kind,
      path: file.path,
      ...(oldPath ? { oldPath } : {})
    });
    this.invalidatePath(file.path);
  }

  private invalidatePath(path: string): void {
    try {
      this.invalidatedPaths.add(normalizeAndValidatePath(path));
    } catch {
      // Vault events with unsafe paths cannot affect the active vault index.
    }
  }
}

export class ObsidianVaultWriter implements WritableVault {
  constructor(private readonly vault: WritableVaultEventSource) {}

  async read(path: string): Promise<{ content: string; revision: string }> {
    const file = this.findMarkdownFile(path);
    const content = await this.vault.read(file);
    return { content, revision: revisionFor(path, content) };
  }

  async write(path: string, content: string): Promise<void> {
    await this.vault.modify(this.findMarkdownFile(path), content);
  }

  async writeIfCurrent(path: string, before: string, content: string): Promise<boolean> {
    const file = this.findMarkdownFile(path);
    if (!this.vault.process) {
      const current = await this.vault.read(file);
      if (current !== before) return false;
      await this.vault.modify(file, content);
      return true;
    }
    let applied = false;
    await this.vault.process(file, (current) => {
      if (current !== before) return current;
      applied = true;
      return content;
    });
    return applied;
  }

  private findMarkdownFile(path: string): VaultFileHandle {
    const normalizedPath = normalizeAndValidatePath(path);
    const file = this.vault
      .getFiles()
      .find((candidate) => normalizeAndValidatePath(candidate.path) === normalizedPath);
    if (!file || file.extension !== "md") throw new Error("Vault file is unavailable for apply.");
    return file;
  }
}

function isVaultFileHandle(value: unknown): value is VaultFileHandle {
  return (
    value !== null &&
    typeof value === "object" &&
    "path" in value &&
    "extension" in value &&
    typeof value.path === "string" &&
    typeof value.extension === "string"
  );
}

function normalizeAndValidatePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    hasControlCharacters(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("Vault path resolves outside the active vault.");
  }
  return normalized;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function revisionFor(path: string, content: string): string {
  return createHash("sha256").update(path).update("\0").update(content).digest("hex");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("Vault read was cancelled.");
  error.name = "AbortError";
  throw error;
}
