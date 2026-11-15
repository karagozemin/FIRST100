import { describe, expect, it, vi } from "vitest";
import { SignedChallengeStore } from "../src/store.js";

describe("SignedChallengeStore", () => {
  it("binds a 32-byte challenge to order, buyer, and expiry", async () => {
    const store = new SignedChallengeStore("a production-length challenge secret for tests");
    const challenge = await store.issueChallenge("order-1", "buyer.testnet", Date.now() + 30_000);

    expect(Buffer.from(challenge, "base64")).toHaveLength(32);
    await expect(store.consumeChallenge("order-1", "buyer.testnet", challenge)).resolves.toBe(true);
    await expect(store.consumeChallenge("order-2", "buyer.testnet", challenge)).resolves.toBe(false);
    await expect(store.consumeChallenge("order-1", "attacker.testnet", challenge)).resolves.toBe(false);
  });

  it("rejects expired and malformed challenges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T00:00:00Z"));
    const store = new SignedChallengeStore("a production-length challenge secret for tests");
    const challenge = await store.issueChallenge("order-1", "buyer.testnet", Date.now() + 1_000);
    vi.advanceTimersByTime(1_001);

    await expect(store.consumeChallenge("order-1", "buyer.testnet", challenge)).resolves.toBe(false);
    await expect(store.consumeChallenge("order-1", "buyer.testnet", "invalid")).resolves.toBe(false);
    vi.useRealTimers();
  });
});
