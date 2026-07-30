import type { Finding, FindingType } from "../contracts/index.js";
import { resolveInternalReference } from "./resolve.js";
import type { ScanSnapshot } from "../scanner/scan.js";

export function checkReferenceIntegrity(scan: ScanSnapshot): Finding[] {
  const findings: Finding[] = [];

  for (const note of scan.notes) {
    for (const reference of note.references) {
      if (reference.kind === "markdown" && isAllowedExternalUri(reference.rawTarget)) {
        continue;
      }

      const resolved = resolveInternalReference(scan, reference, note.path);
      if (resolved.status === "invalid") {
        findings.push(
          createFinding(
            scan.id,
            note.path,
            reference,
            "invalid-reference",
            "outside or unsupported"
          )
        );
        continue;
      }
      if (resolved.status === "ambiguous") {
        findings.push(
          createFinding(scan.id, note.path, reference, "broken-reference", "ambiguous target")
        );
        continue;
      }
      if (resolved.status === "missing") {
        findings.push(
          createFinding(scan.id, note.path, reference, "broken-reference", "missing target")
        );
        continue;
      }
      if (!resolved.anchorExists) {
        findings.push(
          createFinding(scan.id, note.path, reference, "broken-reference", "missing anchor")
        );
      }
    }
  }

  return findings;
}

function isAllowedExternalUri(target: string): boolean {
  return /^https?:/i.test(target);
}

function createFinding(
  scanId: string,
  notePath: string,
  reference: { locator: string; excerpt: string },
  type: FindingType,
  reason: string
): Finding {
  const invalid = type === "invalid-reference";
  return {
    schemaVersion: 1,
    id: `${scanId}:${notePath}:${reference.locator}:${type}`,
    scanId,
    type,
    severity: "medium",
    evidence: [{ notePath, locator: reference.locator, excerpt: reference.excerpt }],
    affectedNoteIds: [notePath],
    explanation: invalid
      ? `The reference target is ${reason} and cannot be resolved inside this vault.`
      : `The reference has a ${reason} in this scan snapshot.`,
    suggestedFixes: [{ description: "Update the reference or create the missing target." }],
    confidence: 1,
    status: "open"
  };
}
