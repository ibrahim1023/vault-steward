import type { ReviewerFeedbackRecord } from "../storage/repositories.js";
import { recurringSuppressionCandidates } from "../feedback/local-learning.js";

export function FeedbackLearningView({
  records,
  suppressedPatterns,
  suppressPattern
}: {
  records: readonly ReviewerFeedbackRecord[];
  suppressedPatterns: readonly string[];
  suppressPattern: (pattern: string) => Promise<void>;
}) {
  const candidates = recurringSuppressionCandidates(records);
  return (
    <details className="feedback-learning-view">
      <summary>Local review feedback</summary>
      <p>Feedback stays on this device and only changes review order or local suppression.</p>
      {candidates.length === 0 ? (
        <p>No repeated false-positive patterns need review yet.</p>
      ) : (
        <ul>
          {candidates.map((candidate) => {
            const suppressed = suppressedPatterns.includes(candidate.key);
            return (
              <li key={candidate.key}>
                <span>{candidate.key}</span>
                <small>{candidate.count} local false-positive reports</small>
                <button
                  type="button"
                  disabled={suppressed}
                  onClick={() => void suppressPattern(candidate.key)}
                >
                  {suppressed ? "Suppressed from primary review" : "Suppress from primary review"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}
