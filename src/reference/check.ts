import { createHash } from "node:crypto";

import type { Finding, FindingType } from "../contracts/index.js";
import {
  createReferenceFindingIdentity,
  type ReferenceIdentityInput
} from "../findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../findings/normalize.js";
import type { ScanSnapshot, ScannedNote, ParsedReference } from "../scanner/scan.js";
import { resolveInternalReference } from "./resolve.js";

export function checkReferenceIntegrity(scan: ScanSnapshot): Finding[] {
  const findings: Finding[] = [];
  const availableEvidence = scan.notes.flatMap((note) =>
    note.references.map((reference) => ({
      notePath: note.path,
      locator: reference.locator,
      excerpt: reference.excerpt
    }))
  );

  for (const note of scan.notes) {
    for (const reference of note.references) {
      if (reference.kind === "markdown" && isAllowedExternalUri(reference.rawTarget)) {
        continue;
      }

      const resolved = resolveInternalReference(scan, reference, note.path);
      const finding = createFinding(scan.id, note, reference, resolved);
      if (finding) findings.push(finding);
    }
  }

  function createFinding(
    scanId: string,
    note: ScannedNote,
    reference: ParsedReference,
    resolved: ReturnType<typeof resolveInternalReference>
  ): Finding | null {
    let type: FindingType;
    let subtype: ReferenceIdentityInput["subtype"];
    let reason: string;
    let normalizedTarget: string;
    let targetSubjectId: string | undefined;
    if (resolved.status === "invalid") {
      type = "invalid-reference";
      subtype = "invalid";
      reason = "outside or unsupported";
      normalizedTarget = `invalid-target:v1:${createHash("sha256")
        .update(reference.rawTarget)
        .digest("hex")}`;
    } else if (resolved.status === "ambiguous") {
      type = "broken-reference";
      subtype = "ambiguous";
      reason = "ambiguous target";
      normalizedTarget = resolved.requestedPath;
    } else if (resolved.status === "missing") {
      type = "broken-reference";
      subtype = "missing";
      reason = "missing target";
      normalizedTarget = resolved.requestedPath;
    } else if (resolved.anchorExists) {
      return null;
    } else {
      type = "broken-reference";
      subtype = "missing-anchor";
      reason = "missing anchor";
      normalizedTarget = resolved.anchor
        ? `${resolved.canonicalPath}#${resolved.anchor.normalized}`
        : resolved.canonicalPath;
      targetSubjectId = resolved.note.subjectId;
    }
    return promoteFinding(
      scanId,
      note,
      reference,
      type,
      subtype,
      reason,
      normalizedTarget,
      targetSubjectId
    );
  }

  function promoteFinding(
    scanId: string,
    note: ScannedNote,
    reference: ParsedReference,
    type: FindingType,
    subtype: ReferenceIdentityInput["subtype"],
    reason: string,
    normalizedTarget: string,
    targetSubjectId: string | undefined
  ): Finding | null {
    const evidence: PromotedEvidence = {
      notePath: note.path,
      locator: reference.locator,
      excerpt: reference.excerpt,
      role: "reference",
      subjectId: note.subjectId,
      sourceRevision: note.revision
    };
    const identityInput: ReferenceIdentityInput = {
      family: type as ReferenceIdentityInput["family"],
      subtype,
      sourceSubjectId: note.subjectId,
      normalizedTarget,
      ...(targetSubjectId === undefined ? {} : { targetSubjectId })
    };
    try {
      return normalizeFinding({
        scanId,
        type,
        severity: "medium",
        identity: createReferenceFindingIdentity(identityInput),
        evidence: [evidence],
        availableEvidence,
        explanation:
          type === "invalid-reference"
            ? `The reference target is ${reason} and cannot be resolved inside this vault.`
            : `The reference has a ${reason} in this scan snapshot.`,
        confidence: 1,
        suggestedFixes: [{ description: "Update the reference or create the missing target." }]
      });
    } catch {
      return null;
    }
  }

  return findings;
}

function isAllowedExternalUri(target: string): boolean {
  return /^https?:/i.test(target);
}
