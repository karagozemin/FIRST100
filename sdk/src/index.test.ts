import { describe, expect, it } from "vitest";
import { breakEvenCalls, canonicalJson, nearToYocto, yoctoToNear } from "./index.js";
import { replayLedger } from "./ledger.js";

describe("FIRST100 SDK", () => {
  it("canonicalizes object keys", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  });
  it("converts NEAR without floating point", () => {
    expect(nearToYocto("8.5")).toBe("8500000000000000000000000");
    expect(yoctoToNear("8500000000000000000000000", 2)).toBe("8.50");
  });
  it("computes ceiling break-even calls", () => {
    expect(breakEvenCalls("850", "100")).toBe(9n);
  });
  it("replays credits for distinct beneficiaries", () => {
    const result = replayLedger([
      { event: "revenue_accrued", orderId: "o1", seriesId: "s1", beneficiary: "a", amountYocto: "100", settledCount: 1 },
      { event: "revenue_accrued", orderId: "o2", seriesId: "s1", beneficiary: "b", amountYocto: "100", settledCount: 2 },
    ], { s1: 100 });
    expect(result.credits).toEqual({ a: "100", b: "100" });
    expect(result.revenueYocto).toBe("200");
  });
  it("rejects duplicate terminal outcomes", () => {
    expect(() => replayLedger([
      { event: "order_refunded", orderId: "o1", buyer: "a", amountYocto: "100" },
      { event: "revenue_accrued", orderId: "o1", seriesId: "s1", beneficiary: "b", amountYocto: "100", settledCount: 1 },
    ], { s1: 100 })).toThrow("multiple terminal outcomes");
  });
  it("rejects counts over the cap", () => {
    expect(() => replayLedger([
      { event: "revenue_accrued", orderId: "o1", seriesId: "s1", beneficiary: "a", amountYocto: "100", settledCount: 2 },
    ], { s1: 1 })).toThrow("violates its cap");
  });
});
