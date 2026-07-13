import { describe, expect, it } from "vitest";
import { validateSchema } from "../../src/schema/check.js";

describe("schema validator", () => {
  it("selects templates and reports required, enum, and type evidence", () => {
    expect(
      validateSchema({ template: "project", status: "unknown", owner: 1, tags: ["ok", 2] }, [
        {
          template: "project",
          required: ["owner", "due"],
          enums: { status: ["open", "archived"] },
          types: { owner: "string", tags: "string[]" }
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "due", locator: "frontmatter:due" }),
        expect.objectContaining({ field: "status" }),
        expect.objectContaining({ field: "owner" }),
        expect.objectContaining({ field: "tags" })
      ])
    );
  });
});
