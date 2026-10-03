import { describe, expect, it } from "vitest";

import { compareFindingOccurrences } from "../../src/findings/compare.js";

const occurrence = (stableKey: string, occurrenceId: string, evidenceRevisionKey: string) => ({
  stableKey,
  occurrenceId,
  evidenceRevisionKey
});

describe("compareFindingOccurrences", () => {
  it("classifies unchanged, changed, resolved, recurring, and new transitions", () => {
    const transitions = compareFindingOccurrences({
      previous: [
        occurrence("finding:v1:aaa", "occurrence:v1:p1", "evidence:v1:r1"),
        occurrence("finding:v1:bbb", "occurrence:v1:p2", "evidence:v1:r2"),
        occurrence("finding:v1:ccc", "occurrence:v1:p3", "evidence:v1:r3"),
        occurrence("finding:v1:ddd", "occurrence:v1:p4", "evidence:v1:r4")
      ],
      current: [
        occurrence("finding:v1:aaa", "occurrence:v1:c1", "evidence:v1:r1"),
        occurrence("finding:v1:bbb", "occurrence:v1:c2", "evidence:v1:r2x"),
        occurrence("finding:v1:eee", "occurrence:v1:c5", "evidence:v1:r5"),
        occurrence("finding:v1:fff", "occurrence:v1:c6", "evidence:v1:r6")
      ],
      historical: [[occurrence("finding:v1:eee", "occurrence:v1:h1", "evidence:v1:r0")]]
    });
    expect(transitions).toEqual([
      {
        kind: "unchanged",
        stableKey: "finding:v1:aaa",
        previousOccurrenceIds: ["occurrence:v1:p1"],
        currentOccurrenceIds: ["occurrence:v1:c1"]
      },
      {
        kind: "changed",
        stableKey: "finding:v1:bbb",
        previousOccurrenceIds: ["occurrence:v1:p2"],
        currentOccurrenceIds: ["occurrence:v1:c2"]
      },
      {
        kind: "resolved",
        stableKey: "finding:v1:ccc",
        previousOccurrenceIds: ["occurrence:v1:p3"],
        currentOccurrenceIds: []
      },
      {
        kind: "resolved",
        stableKey: "finding:v1:ddd",
        previousOccurrenceIds: ["occurrence:v1:p4"],
        currentOccurrenceIds: []
      },
      {
        kind: "recurring",
        stableKey: "finding:v1:eee",
        previousOccurrenceIds: [],
        currentOccurrenceIds: ["occurrence:v1:c5"]
      },
      {
        kind: "new",
        stableKey: "finding:v1:fff",
        previousOccurrenceIds: [],
        currentOccurrenceIds: ["occurrence:v1:c6"]
      }
    ]);
  });

  it("compares evidence revision sets per stable key, not occurrence ids", () => {
    const transitions = compareFindingOccurrences({
      previous: [
        occurrence("finding:v1:aaa", "occurrence:v1:p2", "evidence:v1:r2"),
        occurrence("finding:v1:aaa", "occurrence:v1:p1", "evidence:v1:r1")
      ],
      current: [
        occurrence("finding:v1:aaa", "occurrence:v1:c9", "evidence:v1:r1"),
        occurrence("finding:v1:aaa", "occurrence:v1:c8", "evidence:v1:r2")
      ],
      historical: []
    });
    expect(transitions).toEqual([
      {
        kind: "unchanged",
        stableKey: "finding:v1:aaa",
        previousOccurrenceIds: ["occurrence:v1:p1", "occurrence:v1:p2"],
        currentOccurrenceIds: ["occurrence:v1:c8", "occurrence:v1:c9"]
      }
    ]);
    expect(
      compareFindingOccurrences({
        previous: [occurrence("finding:v1:aaa", "occurrence:v1:p1", "evidence:v1:r1")],
        current: [
          occurrence("finding:v1:aaa", "occurrence:v1:c1", "evidence:v1:r1"),
          occurrence("finding:v1:aaa", "occurrence:v1:c2", "evidence:v1:r2")
        ],
        historical: []
      })[0]?.kind
    ).toBe("changed");
  });

  it("rejects duplicate occurrence ids and contradictory duplicate evidence entries", () => {
    expect(() =>
      compareFindingOccurrences({
        previous: [
          occurrence("finding:v1:aaa", "occurrence:v1:same", "evidence:v1:r1"),
          occurrence("finding:v1:bbb", "occurrence:v1:same", "evidence:v1:r2")
        ],
        current: [],
        historical: []
      })
    ).toThrow("duplicate finding occurrence id");
    expect(() =>
      compareFindingOccurrences({
        previous: [],
        current: [
          occurrence("finding:v1:aaa", "occurrence:v1:c1", "evidence:v1:r1"),
          occurrence("finding:v1:aaa", "occurrence:v1:c2", "evidence:v1:r1")
        ],
        historical: []
      })
    ).toThrow("contradictory duplicate finding occurrence");
    expect(() =>
      compareFindingOccurrences({
        previous: [],
        current: [],
        historical: [
          [
            occurrence("finding:v1:aaa", "occurrence:v1:h1", "evidence:v1:r1"),
            occurrence("finding:v1:aaa", "occurrence:v1:h1", "evidence:v1:r2")
          ]
        ]
      })
    ).toThrow("duplicate finding occurrence id");
  });

  it("permits an unchanged finding to recur across separate historical scans", () => {
    const transitions = compareFindingOccurrences({
      previous: [],
      current: [occurrence("finding:v1:aaa", "occurrence:v1:c1", "evidence:v1:r1")],
      historical: [
        [occurrence("finding:v1:aaa", "occurrence:v1:h1", "evidence:v1:r1")],
        [occurrence("finding:v1:aaa", "occurrence:v1:h2", "evidence:v1:r1")]
      ]
    });
    expect(transitions).toEqual([
      {
        kind: "recurring",
        stableKey: "finding:v1:aaa",
        previousOccurrenceIds: [],
        currentOccurrenceIds: ["occurrence:v1:c1"]
      }
    ]);
  });
});
