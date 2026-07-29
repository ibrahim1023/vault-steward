import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PromptRegistryView } from "../../src/ui/PromptRegistryView.js";

describe("PromptRegistryView", () => {
  it("keeps prompt contents unavailable while exposing version metadata", () => {
    render(<PromptRegistryView />);
    fireEvent.click(screen.getByText("Prompt registry"));
    expect(screen.getByText("contradiction")).toBeInTheDocument();
    expect(screen.getByText(/Raw prompts are not retained/)).toBeInTheDocument();
    expect(screen.queryByText(/UNTRUSTED_VAULT_DATA/)).not.toBeInTheDocument();
  });
});
