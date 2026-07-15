import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createReleaseManifest,
  type PluginManifest,
  validatePluginManifest
} from "../src/packaging/release-manifest.js";

const root = resolve(import.meta.dirname, "..");
const releaseDirectory = resolve(root, "dist", "vault-steward");
const artifactNames = ["main.js", "manifest.json", "sql-wasm.wasm"] as const;

const plugin = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8")) as PluginManifest;
const errors = validatePluginManifest(plugin);
if (errors.length) throw new Error(`Invalid plugin manifest: ${errors.join("; ")}`);

await rm(releaseDirectory, { recursive: true, force: true });
await mkdir(releaseDirectory, { recursive: true });
for (const name of artifactNames)
  await copyFile(resolve(root, name), resolve(releaseDirectory, name));

const artifacts = await Promise.all(
  artifactNames.map(async (path) => ({
    path,
    sha256: createHash("sha256")
      .update(await readFile(resolve(releaseDirectory, path)))
      .digest("hex")
  }))
);
const release = createReleaseManifest(plugin, artifacts);
await writeFile(
  resolve(releaseDirectory, "release-manifest.json"),
  `${JSON.stringify(release, null, 2)}\n`
);
console.log(
  JSON.stringify({
    releaseDirectory,
    version: release.version,
    artifacts: Object.keys(release.artifacts)
  })
);
