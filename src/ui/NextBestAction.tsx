import type { Finding } from "../contracts/index.js";

export function NextBestAction({
  finding,
  onOpen
}: {
  finding: Finding | undefined;
  onOpen: (findingId: string) => void;
}) {
  return (
    <section aria-label="Next best action">
      <h2>Next best action</h2>
      {finding ? (
        <>
          <p>{finding.explanation}</p>
          <button
            type="button"
            onClick={() => onOpen(finding.id)}
            aria-label={`Review ${finding.severity} finding: ${finding.explanation}`}
          >
            Review finding
          </button>
        </>
      ) : (
        <p>No findings need review.</p>
      )}
    </section>
  );
}
