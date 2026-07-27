import { useEffect, useState } from "react";

import type { Finding } from "../contracts/index.js";
import type { FindingExplanation as FindingExplanationResult } from "../agents/finding-explanation.js";

export function FindingExplanation({
  finding,
  explain
}: {
  finding: Finding;
  explain: (finding: Finding) => Promise<FindingExplanationResult>;
}) {
  const [result, setResult] = useState<FindingExplanationResult>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setResult(undefined);
    setLoading(false);
  }, [finding.id]);

  return (
    <section className="finding-optional" aria-label="Evidence explanation">
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          void explain(finding)
            .then(setResult)
            .finally(() => setLoading(false));
        }}
      >
        Explain cited evidence
      </button>
      {loading ? <p role="status">Explaining cited evidence...</p> : null}
      {result?.ok ? <p>{result.text}</p> : null}
      {result && !result.ok ? (
        <p role="alert">
          The configured model could not explain this finding. Check model readiness.
        </p>
      ) : null}
    </section>
  );
}
