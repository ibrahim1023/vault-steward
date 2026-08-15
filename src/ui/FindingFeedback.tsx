import { useState } from "react";

import type { Finding } from "../contracts/index.js";
import type { FeedbackVerdict } from "../feedback/review.js";

export function FindingFeedback({
  finding,
  submit
}: {
  finding: Finding;
  submit: (finding: Finding, verdict: FeedbackVerdict, label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<string>();
  const submitVerdict = (verdict: FeedbackVerdict) => {
    void submit(finding, verdict, label)
      .then(() => setMessage("Feedback recorded locally."))
      .catch(() => setMessage("Feedback could not be recorded."));
  };
  return (
    <section className="finding-optional" aria-label="Finding feedback">
      <input
        aria-label="Feedback label"
        placeholder="Optional label"
        maxLength={120}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <div>
        <button type="button" onClick={() => submitVerdict("useful")}>
          Useful
        </button>
        <button type="button" onClick={() => submitVerdict("false-positive")}>
          False positive
        </button>
        <button type="button" onClick={() => submitVerdict("needs-review")}>
          Needs review
        </button>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
