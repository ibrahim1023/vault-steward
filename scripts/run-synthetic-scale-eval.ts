import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { SyntheticVaultConfig } from "../evals/synthetic/contracts.js";
import { generateSyntheticVault } from "../evals/synthetic/generate.js";
import {
  assertSyntheticScaleBaseline,
  evaluateSyntheticScale,
  type SyntheticScaleReport
} from "../evals/synthetic/scale-evaluation.js";

const root = resolve(import.meta.dirname, "..");
const configPath = process.argv[2] ?? "evals/synthetic/configs/small.json";
if (configPath.startsWith("/") || configPath.includes("..") || !configPath.startsWith("evals/")) {
  throw new Error("Synthetic configuration path is invalid.");
}

const config = JSON.parse(
  await readFile(resolve(root, configPath), "utf8")
) as SyntheticVaultConfig;
const generated = generateSyntheticVault(config);
const outputRoot = resolve(root, "evals/generated", generated.groundTruth.configurationHash);
await rm(outputRoot, { force: true, recursive: true });
for (const file of generated.files) {
  const path = resolve(outputRoot, "vault", file.path);
  if (!path.startsWith(`${outputRoot}/`)) throw new Error("Generated synthetic path is invalid.");
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, file.content, "utf8");
}
await writeFile(
  resolve(outputRoot, "ground-truth.json"),
  `${JSON.stringify(generated.groundTruth, null, 2)}\n`
);
const report = evaluateSyntheticScale(generated);
const baseline = JSON.parse(
  await readFile(resolve(root, "evals/baselines/synthetic-scale.json"), "utf8")
) as SyntheticScaleReport;
assertSyntheticScaleBaseline(report, baseline);
await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  resolve(root, "evals/reports/synthetic-scale.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report));
