import { describe, expect, it } from "vitest";
import { researchNearAccount } from "../src/service.js";

describe("NEAR account research service", () => {
  it("describes a finalized plain account with correct grammar", async () => {
    const result = await researchNearAccount({
      networkId: "testnet",
      viewAccount: async () => ({
        amount: "100",
        locked: "0",
        storage_usage: 182,
        code_hash: "11111111111111111111111111111111",
      }),
      latestFinalBlock: async () => 123,
    }, { accountId: "seller.testnet" });

    expect(result.classification).toBe("account");
    expect(result.summary).toBe(
      "seller.testnet is an account with 182 bytes of onchain storage at finalized block 123.",
    );
    expect(result.source).toBe("finalized-near-rpc");
  });
});
