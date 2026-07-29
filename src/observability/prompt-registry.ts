import { createHash } from "node:crypto";

export type SemanticAgent = "entity" | "contradiction" | "staleness" | "decision";

export type PromptRegistration = {
  agent: SemanticAgent;
  version: string;
  hash: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  compatibleModelFamilies: readonly string[];
};

const SOURCE_TEMPLATES: Record<SemanticAgent, string> = {
  entity: "untrusted-evidence-v1|entity-candidates-json-v1",
  contradiction: "untrusted-evidence-v1|contradiction-candidates-json-v1",
  staleness: "untrusted-evidence-v1|staleness-candidates-json-v1",
  decision: "untrusted-evidence-v1|decision-candidates-json-v1"
};

function registration(agent: SemanticAgent): PromptRegistration {
  return {
    agent,
    version: "v1",
    hash: createHash("sha256").update(SOURCE_TEMPLATES[agent]).digest("hex"),
    inputSchemaVersion: "evidence-context-v1",
    outputSchemaVersion: "candidates-v1",
    compatibleModelFamilies: ["structured-output"]
  };
}

export const PROMPT_REGISTRY: readonly PromptRegistration[] = [
  registration("entity"),
  registration("contradiction"),
  registration("staleness"),
  registration("decision")
];

export function promptRegistryFingerprint(
  entries: readonly PromptRegistration[] = PROMPT_REGISTRY
): string {
  validatePromptRegistry(entries);
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...entries]
          .map((entry) => ({ ...entry, compatibleModelFamilies: [...entry.compatibleModelFamilies] }))
          .sort((left, right) => left.agent.localeCompare(right.agent))
      )
    )
    .digest("hex");
}

export function comparePromptRegistries(
  baseline: readonly PromptRegistration[],
  candidate: readonly PromptRegistration[]
): Array<{ agent: SemanticAgent; change: "added" | "removed" | "changed" }> {
  validatePromptRegistry(baseline);
  validatePromptRegistry(candidate);
  const before = new Map(baseline.map((entry) => [entry.agent, entry]));
  const after = new Map(candidate.map((entry) => [entry.agent, entry]));
  const changes: Array<{ agent: SemanticAgent; change: "added" | "removed" | "changed" }> = [];
  for (const agent of [...new Set([...before.keys(), ...after.keys()])] as SemanticAgent[]) {
      const left = before.get(agent);
      const right = after.get(agent);
      if (!left) changes.push({ agent, change: "added" });
      else if (!right) changes.push({ agent, change: "removed" });
      else if (JSON.stringify(left) !== JSON.stringify(right)) changes.push({ agent, change: "changed" });
  }
  return changes.sort((left, right) => left.agent.localeCompare(right.agent));
}

export function validatePromptRegistry(entries: readonly PromptRegistration[]): void {
  const agents = new Set<string>();
  for (const entry of entries) {
    if (
      !["entity", "contradiction", "staleness", "decision"].includes(entry.agent) ||
      !/^v[1-9][0-9]*$/.test(entry.version) ||
      !/^[a-f0-9]{64}$/.test(entry.hash) ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(entry.inputSchemaVersion) ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(entry.outputSchemaVersion) ||
      entry.compatibleModelFamilies.length === 0 ||
      entry.compatibleModelFamilies.some((family) => !/^[a-z][a-z0-9-]{0,63}$/.test(family)) ||
      agents.has(entry.agent)
    ) {
      throw new Error("Prompt registry entry is invalid.");
    }
    agents.add(entry.agent);
  }
}
