import { access, cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { pluginInstallPath, requiredInstallArtifacts } from "../src/packaging/install.js";

const root = resolve(import.meta.dirname, "..");
const releaseDirectory = resolve(root, "dist", "vault-steward");
const vaultDirectory = await mkdtemp(resolve(tmpdir(), "vault-steward-install-"));
const pluginDirectory = pluginInstallPath(vaultDirectory, "vault-steward");

try {
  await mkdir(resolve(vaultDirectory, ".obsidian", "plugins"), { recursive: true });
  await cp(releaseDirectory, pluginDirectory, { recursive: true, errorOnExist: true });
  for (const artifact of requiredInstallArtifacts())
    await access(resolve(pluginDirectory, artifact));
  await rm(pluginDirectory, { recursive: true });
  await Promise.all(
    requiredInstallArtifacts().map(async (artifact) => {
      await access(resolve(pluginDirectory, artifact)).then(
        () => Promise.reject(new Error(`artifact remains after uninstall: ${artifact}`)),
        () => undefined
      );
    })
  );
  console.log(
    JSON.stringify({ installed: true, uninstalled: true, artifacts: requiredInstallArtifacts() })
  );
} finally {
  await rm(vaultDirectory, { recursive: true, force: true });
}
