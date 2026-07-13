export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  main: string;
  isDesktopOnly: boolean;
};

export type ReleaseArtifact = {
  path: "main.js" | "manifest.json" | "sql-wasm.wasm";
  sha256: string;
};

export type ReleaseManifest = {
  schemaVersion: 1;
  pluginId: string;
  version: string;
  minAppVersion: string;
  artifacts: Record<ReleaseArtifact["path"], string>;
};

export function validatePluginManifest(value: unknown): string[] {
  if (!isRecord(value)) return ["plugin manifest must be an object"];
  const errors: string[] = [];
  if (!isSlug(value.id)) errors.push("manifest id must be a lowercase plugin slug");
  if (!isNonEmptyString(value.name)) errors.push("manifest name must be non-empty");
  if (!isVersion(value.version)) errors.push("manifest version must be semantic version x.y.z");
  if (!isVersion(value.minAppVersion))
    errors.push("manifest minAppVersion must be semantic version x.y.z");
  if (value.main !== "main.js") errors.push("manifest main must be main.js");
  if (value.isDesktopOnly !== true) errors.push("manifest must be desktop only");
  return errors;
}

export function supportsObsidianVersion(appVersion: string, minimumVersion: string): boolean {
  const app = parseVersion(appVersion);
  const minimum = parseVersion(minimumVersion);
  if (!app || !minimum) return false;
  return (
    app[0] > minimum[0] ||
    (app[0] === minimum[0] &&
      (app[1] > minimum[1] || (app[1] === minimum[1] && app[2] >= minimum[2])))
  );
}

export function createReleaseManifest(
  plugin: PluginManifest,
  artifacts: readonly ReleaseArtifact[]
): ReleaseManifest {
  const errors = validatePluginManifest(plugin);
  if (errors.length) throw new Error(errors.join("; "));
  const expected = new Set<ReleaseArtifact["path"]>(["main.js", "manifest.json", "sql-wasm.wasm"]);
  const values = Object.fromEntries(
    artifacts.map((artifact) => {
      if (!expected.delete(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256))
        throw new Error("release artifacts must be unique and have SHA-256 hashes");
      return [artifact.path, artifact.sha256];
    })
  ) as Record<ReleaseArtifact["path"], string>;
  if (expected.size) throw new Error("release artifacts are incomplete");
  return {
    schemaVersion: 1,
    pluginId: plugin.id,
    version: plugin.version,
    minAppVersion: plugin.minAppVersion,
    artifacts: values
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
function isVersion(value: unknown): value is string {
  return typeof value === "string" && parseVersion(value) !== null;
}
function parseVersion(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
