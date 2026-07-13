import type { Finding } from "../contracts/index.js";

export type ReferenceFindingsStatus = "idle" | "scanning" | "error" | "ready";

export function ReferenceFindingsView({
  status,
  findings,
  errorMessage
}: {
  status: ReferenceFindingsStatus;
  findings: readonly Finding[];
  errorMessage?: string;
}) {
  if (status === "idle") return <p>Ready to scan the vault.</p>;
  if (status === "scanning") return <p>Scanning references...</p>;
  if (status === "error")
    return <p role="alert">{errorMessage ?? "The scan could not complete."}</p>;
  if (findings.length === 0) return <p>No reference issues found.</p>;

  return (
    <section aria-label="Reference findings">
      <h2>Reference findings</h2>
      <ul>
        {findings.map((finding) => {
          const evidence = finding.evidence[0];
          return (
            <li key={finding.id}>
              <strong>{capitalize(finding.severity)}</strong>
              <p>{finding.explanation}</p>
              {evidence ? (
                <p>
                  <code>{evidence.notePath}</code> at <code>{evidence.locator}</code>:{" "}
                  <code>{evidence.excerpt}</code>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}
