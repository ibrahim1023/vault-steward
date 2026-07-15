import { describe, expect, it } from "vitest";
import { checkTasks, parseTask } from "../../src/tasks/check.js";

describe("task integrity", () => {
  it("checks malformed, linked, duplicate, overdue, and abandoned tasks without matching prose", () => {
    const issues = checkTasks(
      "prose - [ ] ignored\n- [ ] Broken due:not-a-date\n- [ ] Old owner:ada project:atlas due:2026-07-01 ^old\n- [ ] Same owner:ada project:atlas abandoned:true ^old",
      "2026-07-13T00:00:00Z"
    );
    expect(issues.map((issue) => issue.kind)).toEqual([
      "malformed",
      "malformed",
      "overdue",
      "duplicated",
      "abandoned"
    ]);
  });
  it("accepts ISO timestamps with a timezone", () => {
    expect(
      parseTask("- [ ] Ship owner:ada project:atlas due:2026-07-13T04:00:00+04:00 ^ship", 1)
    ).toMatchObject({ id: "ship", owner: "ada", project: "atlas" });
  });
});
