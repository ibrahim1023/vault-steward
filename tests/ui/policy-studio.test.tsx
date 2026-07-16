import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PolicyStudio } from "../../src/ui/PolicyStudio.js";

const valid = "id: policy\nversion: 1\nrules: []\n";

describe("PolicyStudio", () => {
  afterEach(cleanup);

  it("blocks save for invalid drafts and previews valid drafts only on explicit action", async () => {
    const previewDraft = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, diagnostics: ["policy must be a mapping"] })
      .mockResolvedValueOnce({ ok: true, policy: {}, violations: [] });
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    render(
      <PolicyStudio
        loadDraft={async () => "invalid"}
        previewDraft={previewDraft}
        saveDraft={saveDraft}
      />
    );

    await waitFor(() => expect(screen.getByLabelText("Active policy YAML")).toHaveValue("invalid"));
    fireEvent.click(screen.getByRole("button", { name: "Preview policy" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("policy must be a mapping")
    );
    expect(screen.getByRole("button", { name: "Save policy" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Active policy YAML"), { target: { value: valid } });
    fireEvent.click(screen.getByRole("button", { name: "Save policy" }));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith(valid));
    expect(screen.getByRole("status")).toHaveTextContent("Policy saved.");
  });
});
