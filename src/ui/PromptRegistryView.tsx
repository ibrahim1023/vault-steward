import { PROMPT_REGISTRY } from "../observability/prompt-registry.js";

/** Metadata only. Prompt text and model output remain unavailable unless separately opted in. */
export function PromptRegistryView() {
  return (
    <details className="prompt-registry-view">
      <summary>Prompt registry</summary>
      <p>Version and compatibility metadata only. Raw prompts are not retained here.</p>
      <ul>
        {PROMPT_REGISTRY.map((entry) => (
          <li key={entry.agent}>
            <strong>{entry.agent}</strong>
            <span>{entry.version}</span>
            <code>{entry.hash.slice(0, 12)}</code>
            <span>{entry.inputSchemaVersion} to {entry.outputSchemaVersion}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
