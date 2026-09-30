import type { Finding } from "../contracts/index.js";
import type { VaultEvent } from "../contracts/incremental.js";
import {
  createMaintenanceFindingIdentity,
  type MaintenanceIdentityInput
} from "../findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../findings/normalize.js";
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
  const targetNote = previous.notes.find(
    (note) => note.path === (change.kind === "rename" ? change.oldPath : change.path)
  );
  if (!targetNote) return [];
  const subtype: MaintenanceIdentityInput["subtype"] = change.kind;
  const impact = analyzeChangeImpact(change, previous);
  const referenceFindings = impact.inboundReferences.flatMap((reference) => {
    const source = previous.notes.find((note) => note.path === reference.sourcePath);
    if (!source) return [];
    return promoteMaintenance(
      scanId,
      {
        notePath: reference.sourcePath,
        locator: reference.locator,
        excerpt: reference.excerpt,
        role: "citing",
        subjectId: source.subjectId,
        sourceRevision: source.revision
      },
      {
        subtype,
        sourceSubjectId: source.subjectId,
        targetSubjectId: targetNote.subjectId,
        dependencyKind: "reference"
      },
      change.kind === "rename"
        ? `This note cites a renamed note and should be reviewed for context.`
        : `This note cites a deleted note and should be reviewed for context.`
    );
  });
  const dependencyFindings = [
    ...impact.taskDependents.map((path) => ({ path, kind: "task" as const })),
    ...impact.decisionDependents.map((path) => ({ path, kind: "decision" as const })),
    ...impact.policyDependents.map((path) => ({ path, kind: "policy" as const }))
  ].flatMap(({ path, kind }) => {
    const note = previous.notes.find((item) => item.path === path);
    if (!note) return [];
    return promoteMaintenance(
      scanId,
      {
        notePath: path,
        locator: "frontmatter:dependency",
        excerpt: kind,
        role: "citing",
        subjectId: note.subjectId,
        sourceRevision: note.revision
      },
      {
        subtype,
        sourceSubjectId: note.subjectId,
        targetSubjectId: targetNote.subjectId,
        dependencyKind: kind
      },
      `This ${kind} depends on a ${change.kind === "rename" ? "renamed" : "deleted"} note and should be reviewed.`
    );
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
      .flatMap((reference) =>
        promoteMaintenance(
          scanId,
          {
            notePath: note.path,
            locator: reference.locator,
            excerpt: reference.excerpt,
            role: "citing",
            subjectId: note.subjectId,
            sourceRevision: note.revision
          },
          {
            subtype: "superseded-decision",
            sourceSubjectId: note.subjectId,
            targetSubjectId: after.subjectId
          },
          "This note cites a superseded decision and should be reviewed."
        )
      )
  );
}

function promoteMaintenance(
  scanId: string,
  evidence: PromotedEvidence,
  identity: MaintenanceIdentityInput,
  explanation: string
): Finding[] {
  try {
    const finding = normalizeFinding({
      scanId,
      type: "staleness",
      severity: "low",
      identity: createMaintenanceFindingIdentity(identity),
      evidence: [evidence],
      availableEvidence: [evidence],
      explanation,
      confidence: 1
    });
    return finding ? [finding] : [];
  } catch {
    return [];
  }
}

function isNewlySuperseded(before: ScannedNote | undefined, after: ScannedNote): boolean {
  const afterState =
    after.frontmatter.status === "superseded" || typeof after.frontmatter.supersedes === "string";
  const beforeState =
    before?.frontmatter.status === "superseded" ||
    typeof before?.frontmatter.supersedes === "string";
  return afterState && !beforeState;
}

function unique(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  const output: Finding[] = [];
  for (const finding of findings) {
    const key = finding.schemaVersion === 2 ? finding.occurrenceId : finding.id;
    if (seen.has(key)) {
      if (finding.schemaVersion === 2) throw new Error("duplicate finding occurrence");
      continue;
    }
    seen.add(key);
    output.push(finding);
  }
  return output;
}

function withoutExtension(value: string): string {
  return value.replace(/\.md$/, "");
}
