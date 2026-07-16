import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { type EvaluationCase, type EvaluationSplit, validateEvaluationCase } from "./contracts.js";

export type EvaluationSelection = {
  splits?: readonly EvaluationSplit[];
  caseIds?: readonly string[];
  agent?: string;
};

export async function loadEvaluationCases(root: string, manifest: string, selection: EvaluationSelection = {}): Promise<EvaluationCase[]> {
  const manifestPath = safeResolve(root, manifest);
  const entries = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) throw new Error("Evaluation manifest is invalid.");
  const cases = await Promise.all(entries.map((entry) => loadCase(root, entry)));
  const selected = cases.filter((item) =>
    (!selection.splits || selection.splits.includes(item.split)) &&
    (!selection.caseIds || selection.caseIds.includes(item.id)) &&
    (!selection.agent || item.agent === selection.agent)
  );
  if (selection.caseIds && selected.length !== selection.caseIds.length) throw new Error("Unknown evaluation case.");
  return selected;
}

async function loadCase(root: string, caseDirectory: string): Promise<EvaluationCase> {
  const directory = safeResolve(root, caseDirectory);
  const [metadata, expected] = await Promise.all([
    readJson(resolve(directory, "metadata.json")),
    readJson(resolve(directory, "expected.json"))
  ]);
  const candidate = { ...asObject(metadata), expected };
  if (!validateEvaluationCase(candidate)) throw new Error("Evaluation case is invalid.");
  return candidate;
}

function safeResolve(root: string, path: string): string {
  if (!path.startsWith("evals/") || path.includes("\\") || path.split("/").some((part) => part === "." || part === "..")) throw new Error("Evaluation path is invalid.");
  const resolved = resolve(root, path);
  if (!resolved.startsWith(resolve(root, "evals") + "/")) throw new Error("Evaluation path is invalid.");
  return resolved;
}
async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")) as unknown; }
function asObject(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Evaluation metadata is invalid."); return value as Record<string, unknown>; }
