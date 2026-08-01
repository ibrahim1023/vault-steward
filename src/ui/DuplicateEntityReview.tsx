import type { DuplicateEntityReview as DuplicateEntityReviewData } from "../review/entity-duplicate-review.js";

export function DuplicateEntityReview({ review }: { review: DuplicateEntityReviewData }) {
  const [left, right] = review.notes;
  return (
    <section className="duplicate-entity-review" aria-label="Possible duplicate review">
      <p className="duplicate-entity-intro">
        These two notes have cited naming overlap. Compare them before deciding whether they
        describe the same entity.
      </p>
      <div className="duplicate-entity-notes">
        <NoteSummary note={left} />
        <NoteSummary note={right} />
      </div>
      {review.sharedAliases.length > 0 ? (
        <p className="duplicate-entity-shared">
          <strong>Shared aliases:</strong> {review.sharedAliases.join(", ")}
        </p>
      ) : null}
      <details className="duplicate-entity-evidence">
        <summary>View cited overlap</summary>
        <ul>
          {review.citedEvidence.map((evidence) => (
            <li key={`${evidence.notePath}:${evidence.locator}`}>
              <strong>{evidence.notePath}</strong> ({evidence.locator}): {evidence.excerpt}
            </li>
          ))}
        </ul>
      </details>
      {review.conflictingMetadata.length > 0 ? (
        <details className="duplicate-entity-conflicts">
          <summary>Compare conflicting metadata ({review.conflictingMetadata.length})</summary>
          <dl>
            {review.conflictingMetadata.map((conflict) => (
              <div key={conflict.field}>
                <dt>{conflict.field}</dt>
                <dd>
                  {conflict.left} <span aria-hidden="true">/</span> {conflict.right}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      <p className="duplicate-entity-safety">
        No notes will be combined, deleted, or changed from this review.
      </p>
    </section>
  );
}

function NoteSummary({ note }: { note: DuplicateEntityReviewData["notes"][number] }) {
  return (
    <article className="duplicate-entity-note">
      <h3>{note.title}</h3>
      <p>{note.path}</p>
      <dl>
        <div>
          <dt>Aliases</dt>
          <dd>{note.aliases.length > 0 ? note.aliases.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt>Backlinks</dt>
          <dd>{note.backlinks.length}</dd>
        </div>
      </dl>
    </article>
  );
}
