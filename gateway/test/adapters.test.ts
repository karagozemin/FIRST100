import { describe, expect, it } from "vitest";
import { createDefaultServiceRegistry, ServiceRegistry } from "../src/adapters.js";
import type { NearChain } from "../src/chain.js";

const chain = {
  networkId: "testnet",
  viewAccount: async () => ({
    amount: "100",
    locked: "25",
    storage_usage: 512,
    code_hash: "contract-code-hash",
  }),
  latestFinalBlock: async () => 456,
} as NearChain;

describe("ServiceRegistry", () => {
  it("discovers typed adapters and routes by onchain service id", async () => {
    const registry = createDefaultServiceRegistry(chain);
    expect(registry.list().map((item) => item.id)).toEqual(["research-api", "account-risk"]);

    const result = await registry.execute("account-risk", { accountId: "agent.testnet" }, {
      orderId: "order-1",
      seriesId: "series-1",
      serviceId: "account-risk",
    }) as Record<string, unknown>;
    expect(result).toMatchObject({
      kind: "near-account-risk",
      classification: "contract",
      hasDeployedCode: true,
      source: "finalized-near-rpc",
    });
  });

  it("fails closed for an unconfigured service id", async () => {
    const registry = new ServiceRegistry();
    await expect(registry.execute("unknown", {}, {
      orderId: "order-1",
      seriesId: "series-1",
      serviceId: "unknown",
    })).rejects.toThrow("service adapter is not configured");
  });
});
