import { useMemo, useState } from "react";
import type { Finding } from "../contracts/index.js";
import type { ChangeImpact } from "../indexing/impact.js";
import { groupMaintenanceFindings } from "../maintenance/queue.js";

export function MaintenanceView({
  findings,
  inspectImpact
}: {
  findings: Finding[];
  inspectImpact: (path: string) => ChangeImpact;
}) {
  const [path, setPath] = useState("");
  const [impact, setImpact] = useState<ChangeImpact>();
  const groups = useMemo(() => groupMaintenanceFindings(findings), [findings]);
  return (
    <section aria-label="Maintenance workspace">
      <h2>Maintenance</h2>
      <ul>
        {groups.map((group) => (
          <li key={group.key}>
            {group.representative.explanation} ({group.findings.length})
          </li>
        ))}
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
