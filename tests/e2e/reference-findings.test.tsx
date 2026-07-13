import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createReferenceIntegritySession } from "../../src/plugin/main.js";
import { ReferenceFindingsView } from "../../src/ui/ReferenceFindingsView.js";

describe("reference-integrity flow", () => {
  it("scans a local snapshot and renders evidence without exposing mutation", () => {
    const session = createReferenceIntegritySession();
    const result = session.scan([{ path: "Home.md", content: "[[Missing]]" }]);

    render(<ReferenceFindingsView status="ready" findings={result.findings} />);

    expect(screen.getByText("[[Missing]]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply|approve/i })).not.toBeInTheDocument();
  });
});
