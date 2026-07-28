import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { checkTasks, parseTask } from "../../src/tasks/check.js";

describe("task integrity", () => {
  it("checks malformed, linked, duplicate, overdue, and abandoned tasks without matching prose or wiki-link bullets", () => {
    const issues = checkTasks(
      "prose - [ ] ignored\n- [[Projects/Atlas]]\n- [ ] Broken due:not-a-date\n- [ ] Old owner:ada project:atlas due:2026-07-01 ^old\n- [ ] Same owner:ada project:atlas abandoned:true ^old",
      "2026-07-13T00:00:00Z"
    );
    expect(issues.map((issue) => issue.kind)).toEqual([
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

  it("does not mistake reference-list bullets in the acceptance fixture for tasks", () => {
    const content = readFileSync(
      resolve(process.cwd(), "fixtures/desktop-acceptance-vault/Work/Launch Readiness.md"),
      "utf8"
    );
    const issues = checkTasks(content, "2026-07-28T00:00:00Z");

    expect(issues.filter((issue) => issue.kind === "malformed")).toEqual([
      { id: "line-21", kind: "malformed", line: 21 }
    ]);
    expect(issues.every((issue) => issue.line <= 21)).toBe(true);
  });
});
