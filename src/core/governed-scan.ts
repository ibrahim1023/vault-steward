import { LocalAgentCoordinator, type CoordinatorResult } from "../agents/coordinator.js";
import type { AgentEvidence } from "../agents/model-assisted.js";
import type { Finding } from "../contracts/index.js";
import { checkDecisions, indexDecision } from "../decisions/index.js";
import {
  createDecisionFindingIdentity,
  createEntityAliasFindingIdentity,
  createContradictionFindingIdentity,
  createPolicyFindingIdentity,
  createSchemaFindingIdentity,
  createSemanticStalenessFindingIdentity,
  createTaskFindingIdentity
} from "../findings/identity.js";
import { normalizeFinding, type PromotedEvidence } from "../findings/normalize.js";
import type { ModelProvider } from "../model-provider/local-provider.js";
import type { ModelTrace } from "../model-provider/structured.js";
import { evaluatePolicies, extractPolicyFacts } from "../policy/evaluate.js";
import type { Policy } from "../policy/parse.js";
import { getPolicyTemplate, validatePolicyTemplateNote } from "../policy/templates.js";
import { checkReferenceIntegrity } from "../reference/check.js";
import { scanVaultFiles, type ScanSnapshot, type ScannedNote } from "../scanner/scan.js";
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
  providers: readonly ModelProvider[],
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
      checkTasks(note.content, now).flatMap((issue) => {
        const evidenceRef = lineEvidence(note.path, note.content, issue.line);
        const finding = promote(
          {
            scanId: snapshot.id,
            type: "task",
            severity: issue.kind === "overdue" ? "medium" : "low",
            evidence: [promoteEvidence(note, evidenceRef, "subject")],
            availableEvidence: evidence,
            explanation: `Task ${issue.id} is ${issue.kind}.`,
            confidence: 1
          },
          () =>
            createTaskFindingIdentity({
              subjectId: note.subjectId,
              issueKind: issue.kind,
              taskId: issue.id,
              structuralLocator: evidenceRef.locator
            })
        );
        return finding ? [finding] : [];
      })
    ),
    ...decisionFindings(snapshot, evidence),
    ...schemaFindings(snapshot, evidence, options.schemas ?? []),
    ...templateSchemaFindings(snapshot, evidence, options.policies ?? []),
    ...policyFindings(snapshot, evidence, options.policies ?? [])
  ];
  const semantic = semanticAnalysis.candidates.flatMap((candidate) =>
    normalizeSemanticCandidate(snapshot, evidence, candidate)
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
      const evidenceRef = frontmatterEvidence(
        note.path,
        note.frontmatter,
        `frontmatter:${issue.field}`
      );
      const finding = promote(
        {
          scanId: snapshot.id,
          type: "schema",
          severity: "low",
          evidence: [promoteEvidence(note, evidenceRef, "subject")],
          availableEvidence: evidence,
          explanation: issue.message,
          confidence: 1
        },
        () =>
          createSchemaFindingIdentity({
            subjectId: note.subjectId,
            template: issue.templateId,
            field: issue.field,
            rule: issue.ruleId
          })
      );
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
      const evidenceRef = frontmatterEvidence(note.path, note.frontmatter, issue.locator);
      const finding = promote(
        {
          scanId: snapshot.id,
          type: "schema",
          severity: "low",
          evidence: [promoteEvidence(note, evidenceRef, "subject")],
          availableEvidence: evidence,
          explanation: issue.message,
          confidence: 1
        },
        () =>
          createSchemaFindingIdentity({
            subjectId: note.subjectId,
            template: issue.template,
            field: issue.field,
            rule: issue.rule
          })
      );
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
    const policy = policies.find((item) => item.id === violation.policyId);
    if (!note || !policy) return [];
    const finding = promote(
      {
        scanId: snapshot.id,
        type: "policy",
        severity: violation.severity,
        evidence: [promoteEvidence(note, toEvidence(note), "subject")],
        availableEvidence: evidence,
        explanation: `Policy ${violation.policyId} rule ${violation.ruleId} was violated.`,
        confidence: 1,
        violatedPolicyId: violation.policyId
      },
      () =>
        createPolicyFindingIdentity({
          subjectId: note.subjectId,
          policyId: violation.policyId,
          policyVersion: String(policy.version),
          ruleId: violation.ruleId
        })
    );
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
    const note = snapshot.notes.find((item) => item.path === decision?.notePath);
    if (!decision || !note) return [];
    const evidenceRef = {
      notePath: decision.notePath,
      locator: issue.evidenceLocator,
      excerpt: decision.excerpt
    };
    const finding = promote(
      {
        scanId: snapshot.id,
        type: "decision",
        severity: "low",
        evidence: [promoteEvidence(note, evidenceRef, "subject")],
        availableEvidence: evidence,
        explanation: `Decision ${issue.id} has ${issue.kind.replace("-", " ")}.`,
        confidence: 1
      },
      () =>
        createDecisionFindingIdentity({
          subjectId: note.subjectId,
          issueKind: issue.kind,
          decisionId: decision.id
        })
    );
    return finding ? [finding] : [];
  });
}

function normalizeSemanticCandidate(
  snapshot: ScanSnapshot,
  evidence: readonly AgentEvidence[],
  candidate: unknown
): Finding[] {
  if (!isRecord(candidate)) return [];
  const noteByPath = new Map(snapshot.notes.map((note) => [note.path, note]));
  const promoteCited = (entry: AgentEvidence, role: string): PromotedEvidence | null => {
    const note = noteByPath.get(entry.notePath);
    return note ? promoteEvidence(note, entry, role) : null;
  };

  if (Array.isArray(candidate.labels) && Array.isArray(candidate.evidence)) {
    const cited = candidate.evidence.filter(isEvidence);
    const promoted = cited.map((entry) => promoteCited(entry, "operand"));
    const subjectIds = [...new Set(promoted.map((entry) => entry?.subjectId))];
    if (
      promoted.some((entry) => entry === null) ||
      promoted.length !== 2 ||
      subjectIds.length !== 2
    )
      return [];
    return promotedCandidate(
      snapshot.id,
      "entity-alias",
      promoted as PromotedEvidence[],
      "These notes may describe the same entity.",
      evidence,
      () => createEntityAliasFindingIdentity({ subjectIds: subjectIds as [string, string] }),
      0.8
    );
  }
  if (typeof candidate.explanation !== "string") return [];
  if (isEvidence(candidate.left) && isEvidence(candidate.right)) {
    const left = promoteCited(candidate.left, "left");
    const right = promoteCited(candidate.right, "right");
    if (!left || !right) return [];
    return promotedCandidate(
      snapshot.id,
      "contradiction",
      [left, right],
      candidate.explanation,
      evidence,
      () =>
        createContradictionFindingIdentity({
          left: { subjectId: left.subjectId, structuralLocator: left.locator },
          right: { subjectId: right.subjectId, structuralLocator: right.locator },
          symmetric: true
        }),
      0.7
    );
  }
  if (isEvidence(candidate.evidence) && typeof candidate.decisionId === "string") {
    const promoted = promoteCited(candidate.evidence, "subject");
    const decisionNote =
      noteByPath.get(candidate.decisionId) ?? noteByPath.get(`${candidate.decisionId}.md`);
    if (!promoted || !decisionNote) return [];
    return promotedCandidate(
      snapshot.id,
      "decision",
      [promoted],
      candidate.explanation,
      evidence,
      () =>
        createDecisionFindingIdentity({
          subjectId: promoted.subjectId,
          issueKind: "semantic-review",
          decisionId: decisionNote.subjectId
        }),
      0.7
    );
  }
  if (isEvidence(candidate.evidence)) {
    const promoted = promoteCited(candidate.evidence, "subject");
    if (!promoted) return [];
    return promotedCandidate(
      snapshot.id,
      "staleness",
      [promoted],
      candidate.explanation,
      evidence,
      () =>
        createSemanticStalenessFindingIdentity({
          subjectId: promoted.subjectId,
          ruleId: "inactive-90-days"
        }),
      0.7
    );
  }
  return [];
}

function promotedCandidate(
  scanId: string,
  type: "entity-alias" | "contradiction" | "staleness" | "decision",
  promoted: readonly PromotedEvidence[],
  explanation: string,
  availableEvidence: readonly AgentEvidence[],
  identity: () => ReturnType<typeof createEntityAliasFindingIdentity>,
  confidence: number
): Finding[] {
  if (!promoted.every((entry) => containsEvidence(availableEvidence, entry))) return [];
  const finding = promote(
    {
      scanId,
      type,
      severity: "low",
      evidence: promoted,
      availableEvidence,
      explanation,
      confidence
    },
    identity
  );
  return finding ? [finding] : [];
}

function promote(
  input: Omit<Parameters<typeof normalizeFinding>[0], "identity">,
  identity: () => Parameters<typeof normalizeFinding>[0]["identity"]
): Finding | null {
  try {
    return normalizeFinding({ ...input, identity: identity() });
  } catch {
    return null;
  }
}

function promoteEvidence(
  note: ScannedNote,
  evidence: AgentEvidence,
  role: string
): PromotedEvidence {
  return {
    notePath: evidence.notePath,
    locator: evidence.locator,
    excerpt: evidence.excerpt,
    role,
    subjectId: note.subjectId,
    sourceRevision: note.revision
  };
}

function containsEvidence(available: readonly AgentEvidence[], candidate: AgentEvidence): boolean {
  return available.some(
    (evidence) =>
      evidence.notePath === candidate.notePath &&
      evidence.locator === candidate.locator &&
      evidence.excerpt === candidate.excerpt
  );
}

function toEvidence(note: ScanSnapshot["notes"][number]): AgentEvidence {
  return { notePath: note.path, locator: "line:1:column:1", excerpt: note.content.slice(0, 2_000) };
}

function lineEvidence(notePath: string, content: string, line: number): AgentEvidence {
  return {
    notePath,
    locator: `line:${line}:column:1`,
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
