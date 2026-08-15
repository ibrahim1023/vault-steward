import { describe, expect, it } from "vitest";

import {
  POLICY_TEMPLATE_IDS,
  classifyPolicyTemplateNote,
  getPolicyTemplate,
  renderPolicyTemplateDraft,
  validatePolicyTemplateNote
} from "../../src/policy/templates.js";
import { parsePolicy } from "../../src/policy/parse.js";

describe("policy templates", () => {
  it("defines the five guided templates with safe policy drafts", () => {
    expect(POLICY_TEMPLATE_IDS).toEqual(["project", "decision", "task", "meeting", "research"]);
    const source = renderPolicyTemplateDraft("project");
    expect(source).toContain("templates:");
    expect(source).toContain("- project");
    expect(source).toContain("project.owner");
    expect(parsePolicy(source)).toMatchObject({ ok: true, value: { templates: ["project"] } });
  });

  it("rejects duplicate and unknown template activation", () => {
    expect(parsePolicy("id: x\nversion: 1\ntemplates: [project, project]\nrules: []\n").ok).toBe(
      false
    );
    expect(parsePolicy("id: x\nversion: 1\ntemplates: [unknown]\nrules: []\n").ok).toBe(false);
  });

  it("uses explicit frontmatter type before path and heading hints", () => {
    expect(
      classifyPolicyTemplateNote({
        path: "Research/Release notes.md",
        frontmatter: { kind: "project" },
        headings: ["Research notes"]
      })
    ).toEqual({ templateId: "project", provenance: "frontmatter" });
  });

  it("classifies a single bounded folder or heading signal", () => {
    expect(
      classifyPolicyTemplateNote({
        path: "Decisions/ADR-014.md",
        frontmatter: {},
        headings: ["ADR-014: Retention"]
      })
    ).toEqual({ templateId: "decision", provenance: "folder-and-heading" });
  });

  it("abstains when bounded signals identify competing templates", () => {
    expect(
      classifyPolicyTemplateNote({
        path: "Projects/Research plan.md",
        frontmatter: {},
        headings: ["Research notes"]
      })
    ).toEqual({ templateId: null, provenance: "ambiguous" });
  });

  it("does not classify unrelated notes", () => {
    expect(
      classifyPolicyTemplateNote({ path: "Scratch.md", frontmatter: {}, headings: ["Scratch"] })
    ).toEqual({ templateId: null, provenance: "none" });
    expect(getPolicyTemplate("unknown")).toBeUndefined();
  });

  it("validates only an explicitly activated, unambiguous template", () => {
    expect(
      validatePolicyTemplateNote(
        { path: "Projects/Atlas.md", frontmatter: { kind: "project" }, headings: ["Atlas"] },
        ["project"]
      )
    ).toEqual([
      { field: "owner", message: "Project notes require 'owner'." },
      { field: "status", message: "Project notes require 'status'." }
    ]);
    expect(
      validatePolicyTemplateNote(
        { path: "Projects/Research.md", frontmatter: {}, headings: ["Research notes"] },
        ["project", "research"]
      )
    ).toEqual([]);
  });
});
