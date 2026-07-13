import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PluginStatusView } from "../../src/ui/PluginStatusView.js";

describe("PluginStatusView", () => {
  it("shows the selected vault label and current read-only status", () => {
    render(<PluginStatusView vaultLabel="Personal notes" status="ready" />);

    expect(screen.getByText("Current vault: Personal notes")).toBeInTheDocument();
    expect(screen.getByText("Ready to scan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply|approve/i })).not.toBeInTheDocument();
  });
});
