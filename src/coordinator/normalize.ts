import type { Finding } from "../contracts/index.js";
import type { VaultStewardRepository } from "../storage/repositories.js";

export function normalizeFindings(findings: readonly Finding[]): Finding[] {
  const unique = new Map<string, Finding>();
  for (const finding of findings) {
    if (finding.confidence < 0 || finding.confidence > 1 || finding.evidence.length === 0) continue;
    const key =
      finding.schemaVersion === 2
        ? finding.occurrenceId
        : `${finding.scanId}:${finding.type}:${finding.evidence.map((e) => `${e.notePath}:${e.locator}`).join("|")}`;
    if (unique.has(key)) {
      if (finding.schemaVersion === 2) throw new Error("duplicate finding occurrence");
      continue;
    }
    unique.set(key, finding);
  }
  return [...unique.values()].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || a.id.localeCompare(b.id)
  );
}

export function persistReviewQueue(
  repository: VaultStewardRepository,
  findings: readonly Finding[]
): Finding[] {
  const normalized = normalizeFindings(findings);
  repository.withTransaction(() => {
    for (const finding of normalized) {
      if (finding.schemaVersion === 2) {
        repository.saveFindingIdentity({
          stableKey: finding.identity.stableKey,
          identityVersion: finding.identity.identityVersion,
          family: finding.identity.family,
          subtype: finding.identity.subtype,
          detectorId: finding.identity.detectorId,
          detectorVersion: finding.identity.detectorVersion,
          policyId: finding.identity.policyId ?? null,
          policyVersion: finding.identity.policyVersion ?? null,
          subjectIds: finding.identity.subjectIds,
          semanticKey: finding.identity.semanticKey
        });
        repository.saveFinding({
          id: finding.id,
          scanId: finding.scanId,
          type: finding.type,
          severity: finding.severity,
          status: finding.status,
          evidenceJson: JSON.stringify(finding.evidence),
          payloadJson: JSON.stringify({
            confidence: finding.confidence,
            explanation: finding.explanation,
            violatedPolicyId: finding.violatedPolicyId,
            identity: finding.identity,
            stableKey: finding.stableKey,
            occurrenceId: finding.occurrenceId,
            evidenceRevisionKey: finding.evidenceRevisionKey
          })
        });
        repository.saveFindingOccurrence({
          occurrenceId: finding.occurrenceId,
          stableKey: finding.stableKey,
          findingId: finding.id,
          scanId: finding.scanId,
          evidenceRevisionKey: finding.evidenceRevisionKey,
          identityVersion: 1
        });
        continue;
      }
      repository.saveFinding({
        id: finding.id,
        scanId: finding.scanId,
        type: finding.type,
        severity: finding.severity,
        status: finding.status,
        evidenceJson: JSON.stringify(finding.evidence),
        payloadJson: JSON.stringify({
          confidence: finding.confidence,
          explanation: finding.explanation,
          violatedPolicyId: finding.violatedPolicyId
        })
      });
    }
  });
  return normalized;
}

function severityRank(value: Finding["severity"]): number {
  return ["info", "low", "medium", "high", "critical"].indexOf(value);
}
