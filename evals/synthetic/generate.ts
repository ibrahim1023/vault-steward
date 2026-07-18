import { createHash } from "node:crypto";

import {
  SYNTHETIC_DEFECT_KINDS,
  type GeneratedSyntheticVault,
  type SyntheticDefectKind,
  type SyntheticGroundTruthDefect,
  type SyntheticVaultConfig
} from "./contracts.js";

const MAX_NOTES = 1_000;
const MAX_DEPTH = 16;
const MAX_COUNT = 10_000;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BASE_FRONTMATTER_LINES = 5;

type MutableSyntheticFile = { path: string; lines: string[] };

export function generateSyntheticVault(config: SyntheticVaultConfig): GeneratedSyntheticVault {
  validateConfig(config);
  const random = createPrng(config.seed);
  const files = createBaseFiles(config, random);
  const defects: SyntheticGroundTruthDefect[] = [];
  const rateByKind: Record<SyntheticDefectKind, number> = {
    contradiction: config.contradictionRate,
    "duplicate-entity": config.duplicateEntityRate,
    "broken-reference": config.brokenReferenceRate,
    "stale-note": config.stalenessRate,
    "orphan-task": config.orphanTaskRate,
    "schema-violation": config.schemaViolationRate,
    "unresolved-decision": config.unresolvedDecisionRate
  };

  for (const kind of SYNTHETIC_DEFECT_KINDS) {
    const count = injectionCount(config.noteCount, rateByKind[kind]);
    for (let index = 0; index < count; index++) {
      const file = files[(random() * files.length) | 0]!;
      const locator = injectDefect(file, kind, index);
      defects.push({
        id: `${kind}:${index + 1}`,
        kind,
        notePath: file.path,
        locator
      });
    }
  }

  const orderedFiles = files
    .map((file) => ({ path: file.path, content: `${file.lines.join("\n")}\n` }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const orderedDefects = defects.sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 1,
    files: orderedFiles,
    groundTruth: {
      schemaVersion: 1,
      seed: config.seed,
      configurationHash: hashConfig(config),
      defects: orderedDefects
    },
    achievedDefectCounts: Object.fromEntries(
      SYNTHETIC_DEFECT_KINDS.map((kind) => [
        kind,
        orderedDefects.filter((defect) => defect.kind === kind).length
      ])
    ) as Record<SyntheticDefectKind, number>
  };
}

function createBaseFiles(
  config: SyntheticVaultConfig,
  random: () => number
): MutableSyntheticFile[] {
  const paths = Array.from({ length: config.noteCount }, (_, index) => {
    const number = index + 1;
    const folder = 1 + ((random() * config.folderDepth) | 0);
    return `Synthetic/F${folder}/Note-${number}.md`;
  });
  return paths.map((path, index) => {
    const number = index + 1;
    const nextPath = paths[(index + 1) % paths.length]!.slice(0, -3);
    const entity = `entity-${(index % config.entityCount) + 1}`;
    const lines = [
      "---",
      `title: Synthetic Note ${number}`,
      `entity: ${entity}`,
      "status: active",
      "---",
      "",
      `# Synthetic Note ${number}`,
      "",
      `Entity: ${entity}`
    ];
    if (random() < config.linkDensity) lines.push(`Related: [[${nextPath}]]`);
    if (index < config.taskCount) lines.push(`- [ ] task-${number} #project/synthetic`);
    if (index < config.decisionCount)
      lines.push(`Decision: decision-${number} is resolved with rationale.`);
    return { path, lines };
  });
}

function injectDefect(
  file: MutableSyntheticFile,
  kind: SyntheticDefectKind,
  index: number
): string {
  const physicalLine = file.lines.length + 1;
  const suffix = index + 1;
  switch (kind) {
    case "contradiction":
      file.lines.push(`Status assertion ${suffix}: enabled and disabled.`);
      break;
    case "duplicate-entity":
      file.lines.push(`Entity alias: entity-duplicate-${suffix}`);
      break;
    case "broken-reference":
      file.lines.push(`Broken: [[Synthetic/Missing-${suffix}]]`);
      break;
    case "stale-note":
      file.lines.push("Last reviewed: 2000-01-01");
      break;
    case "orphan-task":
      file.lines.push(`- [ ] orphan-task-${suffix}`);
      break;
    case "schema-violation":
      file.lines.push(`Invalid schema field ${suffix}: []`);
      break;
    case "unresolved-decision":
      file.lines.push(`Decision ${suffix}: unresolved`);
      break;
  }
  // Scanner locators are relative to Markdown content after frontmatter.
  return `line:${physicalLine - BASE_FRONTMATTER_LINES}`;
}

function injectionCount(noteCount: number, rate: number): number {
  return rate === 0 ? 0 : Math.min(noteCount, Math.max(1, Math.floor(noteCount * rate)));
}

function validateConfig(config: SyntheticVaultConfig): void {
  if (!TOKEN.test(config.seed)) throw new Error("seed must be a bounded identifier.");
  validateInteger("noteCount", config.noteCount, 1, MAX_NOTES);
  validateInteger("folderDepth", config.folderDepth, 1, MAX_DEPTH);
  validateInteger("entityCount", config.entityCount, 1, MAX_COUNT);
  validateInteger("taskCount", config.taskCount, 0, MAX_COUNT);
  validateInteger("decisionCount", config.decisionCount, 0, MAX_COUNT);
  for (const [key, value] of Object.entries(config)) {
    if (key.endsWith("Rate") || key === "linkDensity") validateRate(key, value as number);
  }
}

function validateInteger(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
}

function validateRate(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between zero and one.`);
  }
}

function createPrng(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashConfig(config: SyntheticVaultConfig): string {
  return createHash("sha256")
    .update(
      JSON.stringify(Object.entries(config).sort(([left], [right]) => left.localeCompare(right)))
    )
    .digest("hex");
}
