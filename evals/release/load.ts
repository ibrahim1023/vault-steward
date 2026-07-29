import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { type ReleaseCorpus, type ReleaseCorpusCase, validateReleaseCorpus } from "./contracts.js";

export type LoadedReleaseCase = {
  item: ReleaseCorpusCase;
  evidence: Array<{ id: string; notePath: string; locator: string; excerpt: string }>;
};

export async function loadReleaseCorpus(
  root: string,
  path = "evals/release/northstar-v1.json"
): Promise<{ corpus: ReleaseCorpus; cases: LoadedReleaseCase[] }> {
  const corpusPath = safeResolve(root, path, "evals/release/");
  const value = JSON.parse(await readFile(corpusPath, "utf8")) as unknown;
  if (!validateReleaseCorpus(value)) throw new Error("Release corpus is invalid.");

  const fixtureRoot = safeResolve(root, value.fixtureRoot, "fixtures/");
  const cases = await Promise.all(
    value.cases.map(async (item) => ({
      item,
      evidence: await Promise.all(
        item.evidence.map(async (range) => {
          const notePath = safeResolve(fixtureRoot, range.notePath, fixtureRoot);
          const lines = (await readFile(notePath, "utf8")).split("\n");
          if (range.endLine > lines.length)
            throw new Error(`Release evidence range is invalid: ${item.id}.`);
          return {
            id: range.id,
            notePath: range.notePath,
            locator:
              range.startLine === range.endLine
                ? `line:${range.startLine}`
                : `lines:${range.startLine}-${range.endLine}`,
            excerpt: lines.slice(range.startLine - 1, range.endLine).join("\n")
          };
        })
      )
    }))
  );
  return { corpus: value, cases };
}

export function fingerprintReleaseCorpus(input: {
  corpus: ReleaseCorpus;
  cases: readonly LoadedReleaseCase[];
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        corpus: input.corpus,
        evidence: input.cases.map((loaded) =>
          loaded.evidence.map(({ id, notePath, locator, excerpt }) => ({
            id,
            notePath,
            locator,
            excerpt
          }))
        )
      })
    )
    .digest("hex");
}

function safeResolve(root: string, path: string, requiredPrefix: string): string {
  if (
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error("Release corpus path is invalid.");
  const resolved = resolve(root, path);
  const boundary = resolve(root, requiredPrefix);
  if (resolved !== boundary && !resolved.startsWith(`${boundary}/`))
    throw new Error("Release corpus path is invalid.");
  return resolved;
}
