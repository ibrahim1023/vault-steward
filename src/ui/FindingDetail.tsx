import type { ReactNode } from "react";

import type { Finding } from "../contracts/index.js";

export function FindingDetail({
  finding,
  children
}: {
  finding: Finding | undefined;
  children?: ReactNode;
}) {
  if (!finding) return null;
  return (
    <section className="finding-detail" aria-label="Finding detail">
      <h2>Finding detail</h2>
      <p className={`finding-severity finding-severity-${finding.severity}`}>{finding.severity}</p>
      <p className="finding-summary">{finding.explanation}</p>
      <dl className="finding-facts">
        <div>
          <dt>Source</dt>
          <dd>{finding.evidence.map((item) => `${item.notePath} (${item.locator})`).join(", ")}</dd>
        </div>
        <div>
          <dt>Affected notes</dt>
          <dd>{finding.affectedNoteIds.join(", ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{finding.confidence}</dd>
        </div>
      </dl>
      {children}
    </section>
  );
}
