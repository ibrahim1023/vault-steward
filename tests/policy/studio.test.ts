import { describe, expect, it } from "vitest";

import {
  DEFAULT_POLICY_DRAFT,
  POLICY_STUDIO_PATH,
  previewPolicyDraft,
  validatePolicyStudioPath
} from "../../src/policy/studio.js";

describe("policy studio", () => {
  it("accepts only the fixed vault-relative active policy path", () => {
    expect(validatePolicyStudioPath(POLICY_STUDIO_PATH)).toEqual({ ok: true });
    expect(validatePolicyStudioPath("Policies/team.yaml")).toEqual({
      ok: false,
      diagnostic: "Policy Studio may only write its active policy file."
    });
    expect(validatePolicyStudioPath("../.vault-steward/policy.yaml").ok).toBe(false);
  });

  it("keeps invalid YAML out of previews", () => {
    expect(previewPolicyDraft("id: [invalid]", [])).toMatchObject({
      ok: false,
      diagnostics: expect.any(Array)
    });
  });

  it("previews deterministic violations without creating findings", () => {
    const preview = previewPolicyDraft(
      `id: project-owner\nversion: 1\nrules:\n  - id: required\n    fact: project.owner\n    operator: required\n    severity: high\n`,
      [{ path: "Projects/Atlas.md", frontmatter: { kind: "project" } }]
    );

    expect(preview).toEqual({
      ok: true,
      policy: {
        id: "project-owner",
        version: 1,
        enabled: true,
        rules: [
          {
            id: "required",
            fact: "project.owner",
            operator: "required",
            severity: "high"
          }
        ]
      },
      violations: [
        {
          policyId: "project-owner",
          ruleId: "required",
          severity: "high",
          path: "Projects/Atlas.md",
          fact: "project.owner"
        }
      ]
    });
    expect(DEFAULT_POLICY_DRAFT).toContain("version: 1");
  });
});
