import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

import { ChangesView } from "../../src/ui/ChangesView.js";
import type { ChangesSummary } from "../../src/maintenance/changes.js";

const summary: ChangesSummary = {
  status: "compared",
  currentScanId: "scan-3",
  baselineScanId: "scan-2",
  availableBaselineScanIds: ["scan-1", "scan-2"],
  new: [
    {
      kind: "new",
      stableKey: "finding:v1:new",
      previousOccurrenceIds: [],
      currentOccurrenceIds: ["occurrence:v1:new"],
      family: "broken-reference",
      subtype: "missing",
      detail: "Missing.md"
    }
  ],
  changed: [],
  recurring: [],
  resolved: [],
  unchanged: []
};

describe("ChangesView", () => {
  it("renders scan-bound counts and allows selecting a retained baseline without displaying note content", () => {
    const select = vi.fn();
    render(<ChangesView summary={summary} onSelectBaseline={select} />);
    expect(screen.getByRole("region", { name: "Changes since last check" })).toHaveTextContent(
      "1 new"
    );
    expect(screen.getByRole("combobox", { name: "Compare with" })).toHaveValue("scan-2");
    expect(screen.getByText("broken-reference: missing — Missing.md")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Compare with" }), {
      target: { value: "scan-1" }
    });
    expect(select).toHaveBeenCalledWith("scan-1");
    expect(screen.queryByText("[[Secret]]")).toBeNull();
  });

  it("explains empty, legacy, and baseline-only states", () => {
    const { rerender } = render(
      <ChangesView summary={{ status: "no-scan", currentScanId: null }} />
    );
    expect(screen.getByRole("region", { name: "Changes since last check" })).toHaveTextContent(
      "Run a check"
    );
    rerender(<ChangesView summary={{ status: "legacy", currentScanId: "scan-1" }} />);
    expect(screen.getByRole("region", { name: "Changes since last check" })).toHaveTextContent(
      "not comparable"
    );
    rerender(
      <ChangesView
        summary={{ status: "baseline", currentScanId: "scan-2", availableBaselineScanIds: [] }}
      />
    );
    expect(screen.getByRole("region", { name: "Changes since last check" })).toHaveTextContent(
      "baseline"
    );
  });
});
