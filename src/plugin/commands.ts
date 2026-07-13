export const OPEN_STATUS_COMMAND_ID = "open-status";

export type PluginCommand = {
  id: string;
  name: string;
  callback: () => void | Promise<void>;
};

export type PluginCommandRegistry = {
  addCommand(command: PluginCommand): void;
};

export function registerPluginCommands(
  registry: PluginCommandRegistry,
  onOpenStatus: () => void | Promise<void> = () => undefined
): void {
  registry.addCommand({
    id: OPEN_STATUS_COMMAND_ID,
    name: "Open Vault Steward status",
    callback: onOpenStatus
  });
}
