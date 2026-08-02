import { useEffect, useState } from "react";

import type { PolicyPreview } from "../policy/studio.js";
import type { Finding } from "../contracts/index.js";
import {
  listPolicyTemplates,
  renderPolicyTemplateDraft,
  type PolicyTemplateId
} from "../policy/templates.js";

export function PolicyStudio({
  loadDraft,
  previewDraft,
  saveDraft,
  findings = [],
  draftRuleFromFinding
}: {
  loadDraft: () => Promise<string>;
  previewDraft: (source: string) => Promise<PolicyPreview>;
  saveDraft: (source: string) => Promise<void>;
  findings?: readonly Finding[];
  draftRuleFromFinding?: (
    findingId: string,
    source: string
  ) => Promise<import("../policy/studio.js").PolicyRuleDraft>;
}) {
  const [source, setSource] = useState("");
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [preview, setPreview] = useState<PolicyPreview>();
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState<PolicyTemplateId>("project");
  const schemaFindings = findings.filter(
    (finding) => finding.type === "schema" && finding.status === "open"
  );
  const [findingId, setFindingId] = useState("");

  useEffect(() => {
    void loadDraft()
      .then((draft) => setSource(draft))
      .catch(() => setMessage("The active policy file could not be read."))
      .finally(() => setLoading(false));
  }, [loadDraft]);

  const validate = async (): Promise<PolicyPreview | undefined> => {
    setMessage(undefined);
    try {
      const result = await previewDraft(source);
      setPreview(result);
      setDiagnostics(result.ok ? [] : result.diagnostics);
      return result;
    } catch {
      setMessage("Run a completed scan before previewing this policy.");
      return undefined;
    }
  };

  if (loading) return <p role="status">Loading active policy...</p>;
  return (
    <section aria-label="Policy Studio">
      <h2>Policy Studio</h2>
      <div>
        <label>
          Policy template
          <select
            aria-label="Policy template"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value as PolicyTemplateId)}
          >
            {listPolicyTemplates().map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setSource(renderPolicyTemplateDraft(templateId));
            setPreview(undefined);
            setDiagnostics([]);
            setMessage("Template loaded as a draft. Preview it before saving.");
          }}
        >
          Use template
        </button>
      </div>
      <textarea
        aria-label="Active policy YAML"
        value={source}
        onChange={(event) => {
          setSource(event.target.value);
          setPreview(undefined);
          setDiagnostics([]);
          setMessage(undefined);
        }}
      />
      {draftRuleFromFinding && schemaFindings.length > 0 ? (
        <div>
          <label>
            Finding to turn into a rule
            <select
              aria-label="Finding to turn into a rule"
              value={findingId || schemaFindings[0]!.id}
              onChange={(event) => setFindingId(event.target.value)}
            >
              {schemaFindings.map((finding) => (
                <option key={finding.id} value={finding.id}>
                  {finding.explanation}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const selected = findingId || schemaFindings[0]!.id;
              void draftRuleFromFinding(selected, source).then((result) => {
                if (!result.ok) {
                  setMessage(result.diagnostic);
                  return;
                }
                setSource(result.source);
                setPreview(undefined);
                setDiagnostics([]);
                setMessage("Rule added to the draft. Preview it before saving.");
              });
            }}
          >
            Create rule from finding
          </button>
        </div>
      ) : null}
      <div>
        <button type="button" onClick={() => void validate()}>
          Preview policy
        </button>
        <button
          type="button"
          disabled={diagnostics.length > 0}
          onClick={() => {
            void validate().then((result) => {
              if (!result?.ok) return;
              return saveDraft(source)
                .then(() => setMessage("Policy saved."))
                .catch(() => setMessage("The validated policy could not be saved."));
            });
          }}
        >
          Save policy
        </button>
      </div>
      {diagnostics.length > 0 ? (
        <ul role="alert">
          {diagnostics.map((diagnostic) => (
            <li key={diagnostic}>{diagnostic}</li>
          ))}
        </ul>
      ) : null}
      {preview?.ok ? (
        <p>
          Preview: {preview.violations.length} violation
          {preview.violations.length === 1 ? "" : "s"} against the active scan.
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
