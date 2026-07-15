const ARTIFACTS = ["main.js", "manifest.json", "sql-wasm.wasm", "release-manifest.json"] as const;

export function pluginInstallPath(vaultDirectory: string, pluginId: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pluginId))
    throw new Error("plugin id must be a safe slug");
  if (vaultDirectory.includes("\0")) throw new Error("vault directory is invalid");
  return `${vaultDirectory.replace(/\/$/, "")}/.obsidian/plugins/${pluginId}`;
}

export function requiredInstallArtifacts(): readonly (typeof ARTIFACTS)[number][] {
  return ARTIFACTS;
}
