import { describe, expect, it, vi } from "vitest";

import {
  OPEN_STATUS_COMMAND_ID,
  registerPluginCommands,
  type PluginCommand
} from "../../src/plugin/commands.js";

describe("plugin commands", () => {
  it("registers a read-only status command", () => {
    const addCommand = vi.fn();
    registerPluginCommands({ addCommand });

    const command = addCommand.mock.calls[0]?.[0] as PluginCommand;
    expect(command.id).toBe(OPEN_STATUS_COMMAND_ID);
    expect(command.name).toBe("Open status");
    expect(command.callback).toBeTypeOf("function");
  });
});
