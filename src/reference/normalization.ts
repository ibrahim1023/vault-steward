import type { Finding } from "../contracts/index.js";
import { createReferenceFindingIdentity } from "../findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../findings/normalize.js";
import { replaceInternalReference } from "../review/propose.js";
import type { ScanSnapshot } from "../scanner/scan.js";
import { resolveInternalReference } from "./resolve.js";

export type ReferenceNormalizationContext =
  | {
      schemaVersion: 1;
      kind: "verified-rename";
      contextId: string;
      oldPath: string;
      targetPath: string;
    }
  | {
      schemaVersion: 1;
      kind: "confirmed-canonical";
      contextId: string;
      targetPath: string;
    };

export function buildContextualNormalizationFindings(
  snapshot: ScanSnapshot,
  contexts: readonly ReferenceNormalizationContext[]
): Finding[] {
  const findings: Finding[] = [];
  for (const context of validateContexts(snapshot, contexts)) {
    const target = snapshot.notes.find((note) => note.path === context.targetPath);
    if (!target) continue;
    const eligible = snapshot.notes.flatMap((note) =>
      note.references.flatMap((reference) => {
        const resolution = resolveInternalReference(snapshot, reference, note.path);
        if (resolution.status !== "resolved" || resolution.canonicalPath !== context.targetPath)
          return [];
        const replacement = replaceInternalReference(
          reference.excerpt,
          note.path,
          context.targetPath
        );
        return replacement && replacement !== reference.excerpt
          ? [
              {
                notePath: note.path,
                locator: reference.locator,
                excerpt: reference.excerpt,
                role: "reference",
                subjectId: note.subjectId,
                sourceRevision: note.revision
              } satisfies PromotedEvidence
            ]
          : [];
      })
    );
    if (eligible.length < 2) continue;
    const affectedNoteIds = [...new Set(eligible.map((evidence) => evidence.notePath))].sort(
      (left, right) => left.localeCompare(right)
    );
    for (const evidence of eligible) {
      try {
        const finding = normalizeFinding({
          scanId: snapshot.id,
          type: "reference-normalization",
          severity: "info",
          identity: createReferenceFindingIdentity({
            family: "reference-normalization",
            subtype: context.kind,
            sourceSubjectId: evidence.subjectId,
            targetSubjectId: target.subjectId,
            normalizedTarget: context.targetPath
          }),
          evidence: [evidence],
          availableEvidence: eligible,
          affectedNoteIds,
          explanation: `This reference can be normalized to the verified canonical note ${context.targetPath}.`,
          confidence: 1,
          suggestedFixes: [
            { description: "Normalize the destination while preserving visible reference syntax." }
          ]
        });
        if (finding) findings.push(finding);
      } catch {
        continue;
      }
    }
  }
  return findings;
}

function validateContexts(
  snapshot: ScanSnapshot,
  contexts: readonly ReferenceNormalizationContext[]
): ReferenceNormalizationContext[] {
  const paths = new Set(snapshot.notes.map((note) => note.path));
  const ids = new Set<string>();
  return contexts.flatMap((context) => {
    if (
      context.schemaVersion !== 1 ||
      !isBoundedString(context.contextId, 512) ||
      ids.has(context.contextId) ||
      !isSafeVaultPath(context.targetPath) ||
      !paths.has(context.targetPath) ||
      (context.kind === "verified-rename" && !isSafeVaultPath(context.oldPath))
    )
      return [];
    ids.add(context.contextId);
    return [{ ...context }];
  });
}

function isSafeVaultPath(value: string): boolean {
  return (
    value.endsWith(".md") &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").some((part) => !part || part === "." || part === "..") &&
    !hasControlCharacters(value)
  );
}

function isBoundedString(value: string, maximum: number): boolean {
  return value.length > 0 && value.length <= maximum;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
