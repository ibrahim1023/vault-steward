import type { Proposal, ReplaceRangeOperation } from "../contracts/proposal.js";

export function DiffPreview({
  proposal,
  sources,
  maxLength = 4000
}: {
  proposal: Proposal;
  sources: Readonly<Record<string, string>>;
  maxLength?: number;
}) {
  const previews = proposal.operations.flatMap((operation) =>
    createPreview(operation, sources[operation.path])
  );
  if (previews.length !== proposal.operations.length)
    return <p role="alert">Preview unavailable because one or more snapshot texts do not match.</p>;
  return (
    <section aria-label="Proposal diff">
      <h2>Diff preview</h2>
      {previews.map((preview) => (
        <article key={preview.path}>
          <h3>{preview.path}</h3>
          <pre>{truncate(`- ${preview.expected}\n+ ${preview.replacement}`, maxLength)}</pre>
          <pre>{truncate(preview.after, maxLength)}</pre>
        </article>
      ))}
    </section>
  );
}

function createPreview(
  operation: ReplaceRangeOperation,
  source: string | undefined
): Array<{ path: string; expected: string; replacement: string; after: string }> {
  if (!source || source.slice(operation.start, operation.end) !== operation.expected) return [];
  return [
    {
      path: operation.path,
      expected: operation.expected,
      replacement: operation.replacement,
      after: `${source.slice(0, operation.start)}${operation.replacement}${source.slice(operation.end)}`
    }
  ];
}
function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n…`;
}
