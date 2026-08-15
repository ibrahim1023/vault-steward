import { createHash } from "node:crypto";

import type { Finding } from "../contracts/index.js";
import type { VaultEvent } from "../contracts/incremental.js";
import type { ScanSnapshot, ScannedNote } from "../scanner/scan.js";
import { analyzeChangeImpact, type VaultChange } from "../indexing/impact.js";

/**
 * Produces conservative, deterministic review signals from an event and the
 * immutable snapshots on either side of a completed scan. These signals are
 * informational maintenance work, never instructions to mutate notes.
 */
export function buildChangeAwareFindings(input: {
  scanId: string;
  events: readonly VaultEvent[];
  previousNotes: readonly ScannedNote[];
  snapshot: ScanSnapshot;
}): Finding[] {
  const previous: ScanSnapshot = { id: "previous", notes: input.previousNotes };
  const findings: Finding[] = [];

  for (const event of input.events) {
    if (event.kind === "rename" && event.oldPath) {
      findings.push(
        ...impactFindings(
          input.scanId,
          { kind: "rename", oldPath: event.oldPath, path: event.path },
          previous
        )
      );
    } else if (event.kind === "delete") {
      findings.push(
        ...impactFindings(input.scanId, { kind: "delete", path: event.path }, previous)
      );
    } else if (event.kind === "modify") {
      findings.push(
        ...supersededDecisionFindings(input.scanId, event.path, previous, input.snapshot)
      );
    }
  }
  return unique(findings);
}

function impactFindings(scanId: string, change: VaultChange, previous: ScanSnapshot): Finding[] {
  const impact = analyzeChangeImpact(change, previous);
  const referenceFindings = impact.inboundReferences.map((reference) =>
    finding(
      scanId,
      {
        notePath: reference.sourcePath,
        locator: reference.locator,
        excerpt: reference.excerpt
      },
      change.kind === "rename"
        ? `This note cites a renamed note and should be reviewed for context.`
        : `This note cites a deleted note and should be reviewed for context.`
    )
  );
  const dependencyFindings = [
    ...impact.taskDependents.map((path) => ({ path, kind: "task" })),
    ...impact.decisionDependents.map((path) => ({ path, kind: "decision" })),
    ...impact.policyDependents.map((path) => ({ path, kind: "policy" }))
  ].flatMap(({ path, kind }) => {
    const note = previous.notes.find((item) => item.path === path);
    if (!note) return [];
    return [
      finding(
        scanId,
        { notePath: path, locator: "frontmatter:dependency", excerpt: kind },
        `This ${kind} depends on a ${change.kind === "rename" ? "renamed" : "deleted"} note and should be reviewed.`
      )
    ];
  });
  return [...referenceFindings, ...dependencyFindings];
}

function supersededDecisionFindings(
  scanId: string,
  path: string,
  previous: ScanSnapshot,
  snapshot: ScanSnapshot
): Finding[] {
  const before = previous.notes.find((note) => note.path === path);
  const after = snapshot.notes.find((note) => note.path === path);
  if (!after || after.frontmatter.kind !== "decision" || !isNewlySuperseded(before, after))
    return [];
  const target = withoutExtension(path);
  return snapshot.notes.flatMap((note) =>
    note.references
      .filter(
        (reference) => withoutExtension(reference.rawTarget.split("#", 1)[0] ?? "") === target
      )
      .map((reference) =>
        finding(
          scanId,
          {
            notePath: note.path,
            locator: reference.locator,
            excerpt: reference.excerpt
          },
          "This note cites a superseded decision and should be reviewed."
        )
      )
  );
}

function isNewlySuperseded(before: ScannedNote | undefined, after: ScannedNote): boolean {
  const afterState =
    after.frontmatter.status === "superseded" || typeof after.frontmatter.supersedes === "string";
  const beforeState =
    before?.frontmatter.status === "superseded" ||
    typeof before?.frontmatter.supersedes === "string";
  return afterState && !beforeState;
}

function finding(
  scanId: string,
  evidence: Finding["evidence"][number],
  explanation: string
): Finding {
  const id = createHash("sha256")
    .update(`${scanId}:${evidence.notePath}:${evidence.locator}:${explanation}`)
    .digest("hex")
    .slice(0, 20);
  return {
    schemaVersion: 1,
    id: `${scanId}:maintenance:${id}`,
    scanId,
    type: "staleness",
    severity: "low",
    evidence: [evidence],
    affectedNoteIds: [evidence.notePath],
    explanation,
    suggestedFixes: [],
    confidence: 1,
    status: "open"
  };
}

function unique(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => !seen.has(finding.id) && (seen.add(finding.id), true));
}

function withoutExtension(value: string): string {
  return value.replace(/\.md$/, "");
}
