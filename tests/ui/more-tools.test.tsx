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

    const summary = screen.getByText("Advanced");
    const details = summary.closest("details");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(summary.tagName).toBe("SUMMARY");
    summary.focus();
    expect(summary).toHaveFocus();

    fireEvent.click(summary);

    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
  });

  it("does not expose an empty advanced-tools disclosure", () => {
    const { container } = render(<MoreTools>{null}</MoreTools>);

    expect(container).toBeEmptyDOMElement();
  });
});
