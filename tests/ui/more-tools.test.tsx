import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MoreTools } from "../../src/ui/MoreTools.js";

describe("MoreTools", () => {
  it("keeps advanced sections closed until the reachable disclosure is activated", () => {
    render(
      <MoreTools>
        <section>Model</section>
        <section>Maintenance</section>
      </MoreTools>
    );

    const summary = screen.getByText("More");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    summary.focus();
    expect(summary).toHaveFocus();

    fireEvent.click(summary);

    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
  });
});
