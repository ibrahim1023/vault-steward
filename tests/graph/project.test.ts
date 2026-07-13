import { describe, expect, it } from "vitest";

import { projectGraph, type GraphSourceNote } from "../../src/graph/project.js";

const notes: readonly GraphSourceNote[] = [
  {
    path: "Projects/Atlas.md",
    revision: "atlas-1",
    label: "Atlas",
    frontmatter: {
      kind: "project",
      entities: ["Ada"],
      contains: ["Tasks/Launch.md"],
      supersedes: ["Projects/Legacy.md"],
      contradicts: ["Projects/Rumor.md"]
    },
    references: [{ target: "Tasks/Launch.md", locator: "line:4" }]
  },
  {
    path: "Tasks/Launch.md",
    revision: "launch-1",
    label: "Launch",
    frontmatter: { kind: "task", owner: "Ada", project: "Projects/Atlas.md" },
    references: []
  },
  {
    path: "People/Ada.md",
    revision: "ada-1",
    label: "Ada",
    frontmatter: { kind: "entity" },
    references: []
  },
  {
    path: "Projects/Legacy.md",
    revision: "legacy-1",
    label: "Legacy",
    frontmatter: {},
    references: []
  },
  {
    path: "Projects/Rumor.md",
    revision: "rumor-1",
    label: "Rumor",
    frontmatter: {},
    references: []
  }
];

describe("graph projection", () => {
  it("creates stable typed nodes and every declared relation", () => {
    const graph = projectGraph("scan-1", notes);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "note:Projects/Atlas.md", kind: "note" }),
        expect.objectContaining({ id: "project:Projects/Atlas.md", kind: "project" }),
        expect.objectContaining({ id: "task:Tasks/Launch.md", kind: "task" }),
        expect.objectContaining({ id: "entity:People/Ada.md", kind: "entity" })
      ])
    );
    expect(graph.edges.map((edge) => edge.relation).sort()).toEqual([
      "assigned_to",
      "contains",
      "contains",
      "contradicts",
      "mentions",
      "references",
      "supersedes"
    ]);
  });

  it("suppresses duplicate edges and keeps each snapshot independent", () => {
    const duplicated = projectGraph("scan-1", [
      {
        ...notes[0]!,
        references: [
          { target: "Tasks/Launch.md", locator: "line:4" },
          { target: "Tasks/Launch.md", locator: "line:4" }
        ]
      },
      notes[1]!,
      notes[2]!,
      notes[3]!,
      notes[4]!
    ]);
    const later = projectGraph("scan-2", notes);

    expect(duplicated.edges.filter((edge) => edge.relation === "references")).toHaveLength(1);
    expect(later.nodes.every((node) => node.scanId === "scan-2")).toBe(true);
    expect(duplicated.nodes.every((node) => node.scanId === "scan-1")).toBe(true);
  });
});
