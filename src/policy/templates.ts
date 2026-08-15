export const POLICY_TEMPLATE_IDS = ["project", "decision", "task", "meeting", "research"] as const;

export type PolicyTemplateId = (typeof POLICY_TEMPLATE_IDS)[number];
export type TemplateClassificationProvenance =
  "frontmatter" | "folder" | "heading" | "folder-and-heading" | "ambiguous" | "none";

export type PolicyTemplate = {
  id: PolicyTemplateId;
  label: string;
  rules: readonly {
    id: string;
    fact: string;
    operator: "required";
    severity: "low" | "medium";
  }[];
  folders: readonly string[];
  headings: readonly RegExp[];
};

export type TemplateClassification = {
  templateId: PolicyTemplateId | null;
  provenance: TemplateClassificationProvenance;
};

export type TemplateSchemaIssue = { field: string; message: string };

const TEMPLATES: readonly PolicyTemplate[] = [
  {
    id: "project",
    label: "Project",
    rules: [
      {
        id: "project-owner-required",
        fact: "project.owner",
        operator: "required",
        severity: "medium"
      },
      {
        id: "project-status-required",
        fact: "project.status",
        operator: "required",
        severity: "low"
      }
    ],
    folders: ["projects"],
    headings: [/^project(?:\s|:|-|$)/i]
  },
  {
    id: "decision",
    label: "ADR / decision",
    rules: [
      {
        id: "decision-rationale-required",
        fact: "decision.rationale",
        operator: "required",
        severity: "medium"
      },
      {
        id: "decision-status-required",
        fact: "decision.status",
        operator: "required",
        severity: "low"
      }
    ],
    folders: ["decisions", "adrs"],
    headings: [/^(adr[-\s]?\d+|decision)(?:\s|:|-|$)/i]
  },
  {
    id: "task",
    label: "Task note",
    rules: [
      { id: "task-status-required", fact: "task.status", operator: "required", severity: "low" }
    ],
    folders: ["tasks"],
    headings: [/^tasks?(?:\s|:|-|$)/i]
  },
  {
    id: "meeting",
    label: "Meeting note",
    rules: [
      { id: "meeting-date-required", fact: "meeting.date", operator: "required", severity: "low" }
    ],
    folders: ["meetings"],
    headings: [/^meeting(?:\s|:|-|$)/i]
  },
  {
    id: "research",
    label: "Research note",
    rules: [
      {
        id: "research-source-required",
        fact: "research.source",
        operator: "required",
        severity: "low"
      }
    ],
    folders: ["research"],
    headings: [/^research(?:\s|:|-|$)/i]
  }
];

export function getPolicyTemplate(value: string): PolicyTemplate | undefined {
  return TEMPLATES.find((template) => template.id === value);
}

export function isPolicyTemplateId(value: unknown): value is PolicyTemplateId {
  return typeof value === "string" && POLICY_TEMPLATE_IDS.includes(value as PolicyTemplateId);
}

export function listPolicyTemplates(): readonly PolicyTemplate[] {
  return TEMPLATES;
}

export function renderPolicyTemplateDraft(templateId: PolicyTemplateId): string {
  const template = getPolicyTemplate(templateId);
  if (!template) throw new Error("policy template is unavailable");
  return [
    `id: ${templateId}-conventions`,
    "version: 1",
    "enabled: true",
    "templates:",
    `  - ${template.id}`,
    "rules:",
    ...template.rules.flatMap((rule) => [
      `  - id: ${rule.id}`,
      `    fact: ${rule.fact}`,
      "    operator: required",
      `    severity: ${rule.severity}`
    ]),
    ""
  ].join("\n");
}

export function classifyPolicyTemplateNote(input: {
  path: string;
  frontmatter: Record<string, unknown>;
  headings: readonly string[];
}): TemplateClassification {
  const kind =
    typeof input.frontmatter.kind === "string" ? input.frontmatter.kind.toLowerCase() : "";
  if (isPolicyTemplateId(kind)) return { templateId: kind, provenance: "frontmatter" };

  const segments = input.path.toLowerCase().split("/");
  const candidates = TEMPLATES.map((template) => ({
    template,
    folder: template.folders.some((folder) => segments.includes(folder)),
    heading: input.headings.some((heading) =>
      template.headings.some((pattern) => pattern.test(heading.trim()))
    )
  })).filter((candidate) => candidate.folder || candidate.heading);

  if (candidates.length !== 1) {
    return { templateId: null, provenance: candidates.length === 0 ? "none" : "ambiguous" };
  }
  const candidate = candidates[0]!;
  return {
    templateId: candidate.template.id,
    provenance:
      candidate.folder && candidate.heading
        ? "folder-and-heading"
        : candidate.folder
          ? "folder"
          : "heading"
  };
}

export function validatePolicyTemplateNote(
  input: { path: string; frontmatter: Record<string, unknown>; headings: readonly string[] },
  enabledTemplates: readonly PolicyTemplateId[]
): TemplateSchemaIssue[] {
  const classification = classifyPolicyTemplateNote(input);
  if (!classification.templateId || !enabledTemplates.includes(classification.templateId))
    return [];
  const template = getPolicyTemplate(classification.templateId);
  if (!template) return [];
  return template.rules.flatMap((rule) => {
    const field = rule.fact.slice(`${template.id}.`.length);
    const value = input.frontmatter[field];
    return value === undefined || value === ""
      ? [{ field, message: `${template.label} notes require '${field}'.` }]
      : [];
  });
}
