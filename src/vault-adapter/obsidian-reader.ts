import { createHash } from "node:crypto";

import type { VaultFile, VaultReader } from "./types.js";

export type VaultFileHandle = {
  path: string;
  extension: string;
};

export type VaultEventRef = unknown;

export type VaultEventSource = {
  getFiles(): VaultFileHandle[];
  read(file: VaultFileHandle): Promise<string>;
  on(event: string, callback: (...args: unknown[]) => void): VaultEventRef;
  offref(ref: VaultEventRef): void;
};

export class ObsidianVaultReader implements VaultReader {
  private readonly invalidatedPaths = new Set<string>();

  constructor(private readonly vault: VaultEventSource) {}

  async listFiles(signal?: AbortSignal): Promise<readonly VaultFile[]> {
    throwIfAborted(signal);
    const files: VaultFile[] = [];

    for (const file of [...this.vault.getFiles()].sort((left, right) =>
      left.path.localeCompare(right.path)
    )) {
      throwIfAborted(signal);
      const path = normalizeAndValidatePath(file.path);
      const content = file.extension === "md" ? await this.vault.read(file) : "";
      throwIfAborted(signal);
      files.push({ path, content, revision: revisionFor(path, content) });
    }

    return files;
  }

  watchInvalidations(): () => void {
    const refs = [
      this.vault.on("modify", (file) => this.invalidateFile(file)),
      this.vault.on("delete", (file) => this.invalidateFile(file)),
      this.vault.on("rename", (file, oldPath) => {
        this.invalidateFile(file);
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

  private invalidateFile(file: unknown): void {
    if (isVaultFileHandle(file)) this.invalidatePath(file.path);
  }

  private invalidatePath(path: string): void {
    try {
      this.invalidatedPaths.add(normalizeAndValidatePath(path));
    } catch {
      // Vault events with unsafe paths cannot affect the active vault index.
    }
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
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new Error("Vault path resolves outside the active vault.");
  }
  return normalized;
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
