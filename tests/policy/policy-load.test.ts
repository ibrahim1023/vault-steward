import { describe, expect, it } from "vitest";

import VaultStewardPlugin from "../../src/main.js";
import { DEFAULT_POLICY_DRAFT } from "../../src/policy/studio.js";

describe("active policy loading", () => {
  it("uses the starter policy only when the active policy is absent", async () => {
    const plugin = {
      app: {
        vault: {
          adapter: {
            stat: async () => null,
            read: async () => {
              throw new Error("must not read an absent policy");
            }
          }
        }
      }
    };

    await expect(VaultStewardPlugin.prototype.loadPolicyDraft.call(plugin)).resolves.toBe(
      DEFAULT_POLICY_DRAFT
    );
  });

  it("surfaces an unreadable existing policy instead of disabling its rules", async () => {
    const plugin = {
      app: {
        vault: {
          adapter: {
            stat: async () => ({ size: 20 }),
            read: async () => {
              throw new Error("policy unavailable");
            }
          }
        }
      }
    };

    await expect(VaultStewardPlugin.prototype.loadPolicyDraft.call(plugin)).rejects.toThrow(
      "policy unavailable"
    );
  });
});
