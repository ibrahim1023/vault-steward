import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { RetrievalEvent, RetrievalExpectation } from "../evals/retrieval/contracts.js";
import { evaluateRetrievalQuality } from "../evals/retrieval/evaluate.js";

const root = resolve(import.meta.dirname, "..");
const inputPath = process.argv[2] ?? "evals/retrieval/cases/not-configured.json";
if (inputPath.startsWith("/") || inputPath.includes("..") || !inputPath.startsWith("evals/")) {
  throw new Error("Retrieval quality input path is invalid.");
}

const input = JSON.parse(await readFile(resolve(root, inputPath), "utf8")) as unknown;
if (!isRetrievalInput(input)) throw new Error("Retrieval quality input is invalid.");
const report = evaluateRetrievalQuality(input.events, input.expectations);
await mkdir(resolve(root, "evals/reports"), { recursive: true });
await writeFile(
  resolve(root, "evals/reports/retrieval-quality.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report));

function isRetrievalInput(
  value: unknown
): value is { events: RetrievalEvent[]; expectations: RetrievalExpectation[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Partial<{ events: unknown; expectations: unknown }>;
  return Array.isArray(input.events) && Array.isArray(input.expectations);
}
