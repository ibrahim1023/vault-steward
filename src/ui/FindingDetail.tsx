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
    <section aria-label="Finding detail">
      <h2>Finding detail</h2>
      <p>
        <strong>{finding.severity}</strong>
      </p>
      <p>{finding.explanation}</p>
      <p>{finding.evidence.map((item) => `${item.notePath} (${item.locator})`).join(", ")}</p>
      <p>Affected notes: {finding.affectedNoteIds.join(", ")}</p>
      <p>Confidence: {finding.confidence}</p>
      {children}
    </section>
  );
}
