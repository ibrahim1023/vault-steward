import { LocalAgentCoordinator, type CoordinatorResult } from "../agents/coordinator.js";
import type { AgentEvidence } from "../agents/model-assisted.js";
import type { Finding } from "../contracts/index.js";
import { checkDecisions, indexDecision } from "../decisions/index.js";
import { normalizeFinding } from "../findings/normalize.js";
import type { LocalProvider } from "../model-provider/local-provider.js";
import type { ModelTrace } from "../model-provider/structured.js";
import { evaluatePolicies, extractPolicyFacts } from "../policy/evaluate.js";
import type { Policy } from "../policy/parse.js";
import { getPolicyTemplate, validatePolicyTemplateNote } from "../policy/templates.js";
import { checkReferenceIntegrity } from "../reference/check.js";
import { scanVaultFiles, type ScanSnapshot } from "../scanner/scan.js";
import { validateSchema, type SchemaDefinition } from "../schema/check.js";
import { checkTasks } from "../tasks/check.js";
import type { VaultFile } from "../vault-adapter/types.js";

export type GovernedScanResult = {
  scanId: string;
  findings: Finding[];
  modelTraces: ModelTrace[];
  limitations: string[];
  completed: boolean;
  semanticAnalysis: CoordinatorResult;
};

export type GovernedScanOptions = {
  schemas?: readonly SchemaDefinition[];
  policies?: readonly Policy[];
  snapshot?: ScanSnapshot;
  coordinator?: LocalAgentCoordinator;
};

export async function runGovernedScan(
  files: readonly VaultFile[],
  providers: readonly LocalProvider[],
  now: string,
  options: GovernedScanOptions = {}
): Promise<GovernedScanResult> {
  const snapshot = options.snapshot ?? scanVaultFiles(files);
  const agentEvidence = snapshot.notes.map(toEvidence);
  const activeEvidence = collectActiveEvidence(
    snapshot,
    options.schemas ?? [],
    options.policies ?? []
  );
  const coordinator = options.coordinator ?? new LocalAgentCoordinator(providers);
  const semanticAnalysis = await coordinator.run({
    scanId: snapshot.id,
    now,
    evidence: agentEvidence,
    propositions: snapshot.notes.flatMap((note) =>
      typeof note.frontmatter.statement === "string"
        ? [{ ...toEvidence(note), statement: note.frontmatter.statement }]
        : []
    ),
    stalenessRecords: snapshot.notes.flatMap((note) => {
      const updatedAt = note.frontmatter.updatedAt;
      return typeof updatedAt === "string"
        ? [
            {
              ...toEvidence(note),
              updatedAt,
              projectStatus:
                typeof note.frontmatter.status === "string" ? note.frontmatter.status : "",
              archival: note.frontmatter.archival === true
            }
          ]
        : [];
    }),
    decisions: snapshot.notes.flatMap((note) => {
      const decision = indexDecision(note.path, note.frontmatter);
      return decision
        ? [
            {
              ...decision,
              evidence: {
                notePath: note.path,
                locator: decision.evidenceLocator,
                excerpt: "decision"
              }
            }
          ]
        : [];
    })
  });

  if (
    !semanticAnalysis.completed &&
    !semanticAnalysis.limitations.includes("local-model-output-unavailable")
  ) {
    return {
      scanId: snapshot.id,
      findings: [],
      modelTraces: semanticAnalysis.traces,
      limitations: semanticAnalysis.limitations,
      completed: false,
      semanticAnalysis
    };
  }

  return {
    scanId: snapshot.id,
    findings: normalizeFindings(snapshot, activeEvidence, semanticAnalysis, now, options),
    modelTraces: semanticAnalysis.traces,
    limitations: semanticAnalysis.limitations,
    completed: true,
    semanticAnalysis
  };
}

function normalizeFindings(
  snapshot: ScanSnapshot,
  evidence: readonly AgentEvidence[],
  semanticAnalysis: CoordinatorResult,
  now: string,
  options: GovernedScanOptions
): Finding[] {
  const deterministic = [
    ...checkReferenceIntegrity(snapshot),
    ...snapshot.notes.flatMap((note) =>
      checkTasks(note.content, now).flatMap(
        (issue) =>
          normalizeFinding({
            scanId: snapshot.id,
            type: "task",
            severity: issue.kind === "overdue" ? "medium" : "low",
            evidence: [lineEvidence(note.path, note.content, issue.line)],
            availableEvidence: evidence,
            explanation: `Task ${issue.id} is ${issue.kind}.`,
            confidence: 1
          }) ?? []
      )
    ),
    ...decisionFindings(snapshot, evidence),
    ...schemaFindings(snapshot, evidence, options.schemas ?? []),
    ...templateSchemaFindings(snapshot, evidence, options.policies ?? []),
    ...policyFindings(snapshot, evidence, options.policies ?? [])
  ];
  const semantic = semanticAnalysis.candidates.flatMap((candidate) =>
    normalizeSemanticCandidate(snapshot.id, evidence, candidate)
  );
  return [...deterministic, ...semantic];
}

function templateSchemaFindings(
  snapshot: ScanSnapshot,
  evidence: readonly AgentEvidence[],
  policies: readonly Policy[]
): Finding[] {
  const enabledTemplates = [
    ...new Set(
      policies.filter((policy) => policy.enabled).flatMap((policy) => policy.templates ?? [])
    )
  ];
  if (enabledTemplates.length === 0) return [];
  return snapshot.notes.flatMap((note) =>
    validatePolicyTemplateNote(note, enabledTemplates).flatMap((issue) => {
      const finding = normalizeFinding({
        scanId: snapshot.id,
        type: "schema",
        severity: "low",
        evidence: [frontmatterEvidence(note.path, note.frontmatter, `frontmatter:${issue.field}`)],
        availableEvidence: evidence,
        explanation: issue.message,
        confidence: 1
      });
      return finding ? [finding] : [];
    })
  );
}

function schemaFindings(
  snapshot: ScanSnapshot,
  evidence: readonly AgentEvidence[],
  schemas: readonly SchemaDefinition[]
): Finding[] {
  return snapshot.notes.flatMap((note) =>
    validateSchema(note.frontmatter, schemas).flatMap((issue) => {
      const finding = normalizeFinding({
        scanId: snapshot.id,
        type: "schema",
        severity: "low",
        evidence: [frontmatterEvidence(note.path, note.frontmatter, issue.locator)],
        availableEvidence: evidence,
        explanation: issue.message,
        confidence: 1
      });
      return finding ? [finding] : [];
    })
  );
}

function policyFindings(
  snapshot: ScanSnapshot,
  evidence: readonly AgentEvidence[],
  policies: readonly Policy[]
): Finding[] {
  const facts = extractPolicyFacts(
    snapshot.notes.map((note) => ({ path: note.path, frontmatter: note.frontmatter }))
  );
  return evaluatePolicies(policies, facts).flatMap((violation) => {
    const note = snapshot.notes.find((item) => item.path === violation.path);
    if (!note) return [];
    const finding = normalizeFinding({
      scanId: snapshot.id,
      type: "policy",
      severity: violation.severity,
      evidence: [toEvidence(note)],
      availableEvidence: evidence,
      explanation: `Policy ${violation.policyId} rule ${violation.ruleId} was violated.`,
      confidence: 1,
      violatedPolicyId: violation.policyId
    });
    return finding ? [finding] : [];
  });
}

function decisionFindings(snapshot: ScanSnapshot, evidence: readonly AgentEvidence[]): Finding[] {
  const decisions = snapshot.notes.flatMap((note) => {
    const decision = indexDecision(note.path, note.frontmatter);
    return decision ? [{ ...decision, notePath: note.path, excerpt: "decision" }] : [];
  });
  return checkDecisions(
    decisions,
    snapshot.notes.map((note) => note.path)
  ).flatMap((issue) => {
    const decision = decisions.find((item) => item.id === issue.id);
    if (!decision) return [];
    const finding = normalizeFinding({
      scanId: snapshot.id,
      type: "decision",
      severity: "low",
      evidence: [
        { notePath: decision.notePath, locator: issue.evidenceLocator, excerpt: decision.excerpt }
      ],
      availableEvidence: evidence,
      explanation: `Decision ${issue.id} has ${issue.kind.replace("-", " ")}.`,
      confidence: 1
    });
    return finding ? [finding] : [];
  });
}

function normalizeSemanticCandidate(
  scanId: string,
  evidence: readonly AgentEvidence[],
  candidate: unknown
): Finding[] {
  if (!isRecord(candidate) || typeof candidate.explanation !== "string") return [];
  if (Array.isArray(candidate.labels) && Array.isArray(candidate.evidence)) {
    return normalized(
      scanId,
      "entity-alias",
      "low",
      candidate.evidence,
      candidate.explanation,
      evidence
    );
  }
  if (isEvidence(candidate.left) && isEvidence(candidate.right)) {
    return normalized(
      scanId,
      "contradiction",
      "low",
      [candidate.left, candidate.right],
      candidate.explanation,
      evidence
    );
  }
  if (isEvidence(candidate.evidence) && typeof candidate.decisionId === "string") {
    return normalized(
      scanId,
      "decision",
      "low",
      [candidate.evidence],
      candidate.explanation,
      evidence
    );
  }
  if (isEvidence(candidate.evidence)) {
    return normalized(
      scanId,
      "staleness",
      "low",
      [candidate.evidence],
      candidate.explanation,
      evidence
    );
  }
  return [];
}

function normalized(
  scanId: string,
  type: "entity-alias" | "contradiction" | "staleness" | "decision",
  severity: "low",
  candidateEvidence: readonly unknown[],
  explanation: string,
  availableEvidence: readonly AgentEvidence[]
): Finding[] {
  if (!candidateEvidence.every(isEvidence)) return [];
  const finding = normalizeFinding({
    scanId,
    type,
    severity,
    evidence: candidateEvidence,
    availableEvidence,
    explanation,
    confidence: type === "entity-alias" ? 0.8 : 0.7
  });
  return finding ? [finding] : [];
}

function toEvidence(note: ScanSnapshot["notes"][number]): AgentEvidence {
  return { notePath: note.path, locator: "line:1", excerpt: note.content.slice(0, 2_000) };
}

function lineEvidence(notePath: string, content: string, line: number): AgentEvidence {
  return {
    notePath,
    locator: `line:${line}`,
    excerpt: content.split("\n")[line - 1] ?? ""
  };
}

function frontmatterEvidence(
  notePath: string,
  frontmatter: Record<string, unknown>,
  locator: string
): AgentEvidence {
  const field = locator.replace("frontmatter:", "");
  const value = frontmatter[field];
  return { notePath, locator, excerpt: value === undefined ? "" : String(value) };
}

function collectActiveEvidence(
  snapshot: ScanSnapshot,
  schemas: readonly SchemaDefinition[],
  policies: readonly Policy[]
): AgentEvidence[] {
  return snapshot.notes.flatMap((note) => {
    const lines = note.content.split("\n").slice(0, 100);
    const lineEvidenceEntries = lines.map((_, index) =>
      lineEvidence(note.path, note.content, index + 1)
    );
    const decision = indexDecision(note.path, note.frontmatter);
    const schemaFields = schemas.flatMap((schema) => [
      ...(schema.required ?? []),
      ...Object.keys(schema.enums ?? {}),
      ...Object.keys(schema.types ?? {})
    ]);
    const templateFields = policies
      .filter((policy) => policy.enabled)
      .flatMap((policy) => policy.templates ?? [])
      .flatMap((templateId) => getPolicyTemplate(templateId)?.rules ?? [])
      .map((rule) => rule.fact.split(".", 2)[1] ?? "");
    const frontmatterEvidenceEntries = [
      ...new Set([...Object.keys(note.frontmatter), ...schemaFields, ...templateFields])
    ]
      .filter(Boolean)
      .map((field) => frontmatterEvidence(note.path, note.frontmatter, `frontmatter:${field}`));
    return [
      toEvidence(note),
      ...lineEvidenceEntries,
      ...frontmatterEvidenceEntries,
      ...(decision
        ? [{ notePath: note.path, locator: decision.evidenceLocator, excerpt: "decision" }]
        : [])
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEvidence(value: unknown): value is AgentEvidence {
  return (
    isRecord(value) &&
    typeof value.notePath === "string" &&
    typeof value.locator === "string" &&
    typeof value.excerpt === "string"
  );
}
