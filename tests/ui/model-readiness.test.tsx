import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ModelReadinessView } from "../../src/ui/ModelReadinessView.js";

describe("ModelReadinessView", () => {
  afterEach(cleanup);

  it("shows the configured limits and readiness result after an explicit check", async () => {
    render(
      <ModelReadinessView
        checkReadiness={async () => ({
          available: true,
          structuredOutput: true,
          provider: "ollama",
          model: "test",
          timeoutMs: 30,
          maxResponseBytes: 100,
          latencyMs: 4
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Check readiness" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Ready: ollama / test")
    );
  });
});
