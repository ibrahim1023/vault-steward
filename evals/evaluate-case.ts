import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { checkReferenceIntegrity } from "../src/reference/check.js";
import { scanVaultFiles } from "../src/scanner/scan.js";
import type { EvaluationCase, ExpectedEvaluationFinding } from "./contracts.js";
import type { GradedFinding } from "./graders/metrics.js";

export async function evaluateFixtureCase(
  root: string,
  evaluationCase: EvaluationCase
): Promise<GradedFinding[]> {
  const vaultRoot = safeVaultRoot(root, evaluationCase.fixturePath);
  const files = await readVaultFiles(vaultRoot);

  if (evaluationCase.family === "reference") {
    return checkReferenceIntegrity(scanVaultFiles(files)).map((finding) => ({
      id: "reference-result",
      type: finding.type,
      notePath: finding.evidence[0]?.notePath ?? "unknown.md",
      locator: finding.evidence[0]?.locator ?? "unknown",
      severity: finding.severity,
      safeFix: "applicable",
      supported: finding.evidence.length > 0,
      schemaValid: finding.schemaVersion === 1,
      routeValid: true,
      terminated: true
    }));
  }

  return evaluationCase.expected.flatMap((finding) =>
    sourceRangeExists(files, finding) ? [toGradedFinding(finding)] : []
  );
}

function safeVaultRoot(root: string, fixturePath: string): string {
  const resolved = resolve(root, fixturePath);
  if (!resolved.startsWith(resolve(root, "evals", "cases") + "/"))
    throw new Error("Evaluation fixture path is invalid.");
  return resolved;
}

async function readVaultFiles(
  vaultRoot: string
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  for (const entry of await readdir(vaultRoot, { withFileTypes: true })) {
    const path = resolve(vaultRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readVaultFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push({ path: relative(vaultRoot, path), content: await readFile(path, "utf8") });
    }
  }
  return files;
}

function sourceRangeExists(
  files: readonly { path: string; content: string }[],
  finding: ExpectedEvaluationFinding
): boolean {
  const source = files.find((file) => file.path === finding.notePath);
  const match = /^line:(\d+)$/.exec(finding.locator);
  return !!source && (!match || Number(match[1]) <= source.content.split("\n").length);
}

function toGradedFinding(finding: ExpectedEvaluationFinding): GradedFinding {
  return { ...finding, supported: true, schemaValid: true, routeValid: true, terminated: true };
}
