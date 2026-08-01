import { useMemo, useState } from "react";
import type { Finding } from "../contracts/index.js";
import type { ChangeImpact } from "../indexing/impact.js";
import { groupMaintenanceFindings } from "../maintenance/queue.js";

export function MaintenanceView({
  findings,
  inspectImpact,
  openNote,
  dismissFinding
}: {
  findings: Finding[];
  inspectImpact: (path: string) => ChangeImpact;
  openNote?: (path: string) => void | Promise<void>;
  dismissFinding?: (finding: Finding) => Promise<void>;
}) {
  const [path, setPath] = useState("");
  const [impact, setImpact] = useState<ChangeImpact>();
  const groups = useMemo(() => groupMaintenanceFindings(findings), [findings]);
  return (
    <section aria-label="Maintenance workspace">
      <h2>Maintenance</h2>
      <p>Review changes that may have made existing knowledge less reliable.</p>
      <ul>
        {groups.map((group) => {
          const sourcePath = group.representative.evidence[0]?.notePath;
          return (
            <li key={group.key}>
              <p>
                {group.representative.explanation} ({group.findings.length})
              </p>
              <div>
                <button
                  type="button"
                  disabled={!sourcePath}
                  onClick={() => sourcePath && void openNote?.(sourcePath)}
                >
                  Open note
                </button>
                <button
                  type="button"
                  onClick={() =>
                    group.representative.affectedNoteIds.forEach((item) => void openNote?.(item))
                  }
                >
                  Review related notes
                </button>
                <button type="button" onClick={() => void dismissFinding?.(group.representative)}>
                  Dismiss signal
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <label>
        Impact path{" "}
        <input
          aria-label="Impact path"
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
      </label>
      <button type="button" disabled={!path} onClick={() => setImpact(inspectImpact(path))}>
        Inspect impact
      </button>
      {impact ? (
        <p>
          References: {impact.inboundReferences.length}; tasks: {impact.taskDependents.length};
          decisions: {impact.decisionDependents.length}; policies: {impact.policyDependents.length}.
        </p>
      ) : null}
    </section>
  );
}
