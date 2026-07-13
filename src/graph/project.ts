export type GraphNodeKind = "note" | "entity" | "project" | "task" | "decision" | "attachment";

export type GraphRelation =
  | "references"
  | "mentions"
  | "duplicates"
  | "contradicts"
  | "supersedes"
  | "contains"
  | "assigned_to";

export type GraphSourceNote = {
  path: string;
  revision: string;
  label: string;
  frontmatter: Record<string, unknown>;
  references: readonly { target: string; locator: string }[];
};

export type GraphNode = {
  id: string;
  scanId: string;
  kind: GraphNodeKind;
  sourceNoteId: string | null;
  label: string;
};

export type GraphEdge = {
  id: string;
  scanId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: GraphRelation;
  evidenceLocator: string;
};

export type GraphProjection = { nodes: GraphNode[]; edges: GraphEdge[] };

export function projectGraph(scanId: string, notes: readonly GraphSourceNote[]): GraphProjection {
  const noteNodes = notes.map((note) => createNode(scanId, "note", note.path, null, note.label));
  const semanticNodes = notes.flatMap((note) => {
    const kind = parseNodeKind(note.frontmatter.kind);
    return kind ? [createNode(scanId, kind, note.path, `note:${note.path}`, note.label)] : [];
  });
  const nodes = uniqueById([...noteNodes, ...semanticNodes]);
  const nodeByPath = new Map(notes.map((note) => [note.path, getPrimaryNodeId(note)]));
  const entityByLabel = new Map(
    semanticNodes
      .filter((node) => node.kind === "entity")
      .map((node) => [node.label.toLowerCase(), node.id])
  );
  const edges: GraphEdge[] = [];

  for (const note of notes) {
    const sourceId = getPrimaryNodeId(note);
    const semanticKind = parseNodeKind(note.frontmatter.kind);
    if (semanticKind === "project") {
      addEdge(edges, scanId, `note:${note.path}`, sourceId, "contains", "frontmatter:kind");
    }
    for (const reference of note.references) {
      const targetId = nodeByPath.get(normalizeTarget(reference.target));
      if (targetId) addEdge(edges, scanId, sourceId, targetId, "references", reference.locator);
    }
    for (const entity of strings(note.frontmatter.entities)) {
      const entityId = entityByLabel.get(entity.toLowerCase());
      if (entityId) addEdge(edges, scanId, sourceId, entityId, "mentions", "frontmatter:entities");
    }
    for (const key of ["duplicates", "contradicts", "supersedes", "contains"] as const) {
      for (const target of strings(note.frontmatter[key])) {
        const targetId = nodeByPath.get(normalizeTarget(target));
        if (targetId) addEdge(edges, scanId, sourceId, targetId, key, `frontmatter:${key}`);
      }
    }
    const project = string(note.frontmatter.project);
    if (project && semanticKind === "task") {
      const projectId = nodeByPath.get(normalizeTarget(project));
      if (projectId) addEdge(edges, scanId, projectId, sourceId, "contains", "frontmatter:project");
    }
    const owner = string(note.frontmatter.owner);
    if (owner && semanticKind === "task") {
      const ownerId = entityByLabel.get(owner.toLowerCase());
      if (ownerId) addEdge(edges, scanId, sourceId, ownerId, "assigned_to", "frontmatter:owner");
    }
  }

  return { nodes, edges: uniqueById(edges) };
}

function createNode(
  scanId: string,
  kind: GraphNodeKind,
  path: string,
  sourceNoteId: string | null,
  label: string
): GraphNode {
  return { id: `${kind}:${path}`, scanId, kind, sourceNoteId, label };
}

function addEdge(
  edges: GraphEdge[],
  scanId: string,
  fromNodeId: string,
  toNodeId: string,
  relation: GraphRelation,
  evidenceLocator: string
): void {
  edges.push({
    id: `${scanId}:${fromNodeId}:${toNodeId}:${relation}`,
    scanId,
    fromNodeId,
    toNodeId,
    relation,
    evidenceLocator
  });
}

function getPrimaryNodeId(note: GraphSourceNote): string {
  return `${parseNodeKind(note.frontmatter.kind) ?? "note"}:${note.path}`;
}

function parseNodeKind(value: unknown): GraphNodeKind | null {
  return value === "entity" ||
    value === "project" ||
    value === "task" ||
    value === "decision" ||
    value === "attachment"
    ? value
    : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeTarget(target: string): string {
  return target.replace(/^\.\//, "").replace(/\[\[|\]\]/g, "");
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
