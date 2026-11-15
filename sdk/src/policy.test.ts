import { describe, expect, it } from "vitest";
import { evaluateSeriesPolicy, type PolicySeries } from "./policy.js";

const series: PolicySeries = {
  id: "series-1",
  service_id: "research-api",
  status: "LISTED",
  cap_n: 100,
  settled_count: 0,
  advance_yocto: "850",
  unit_price_yocto: "10",
  expires_at_ns: "2000000000000000000",
};

describe("investor policy engine", () => {
  it("approves terms inside explicit spending and entitlement limits", () => {
    const result = evaluateSeriesPolicy(series, {
      maxAdvanceYocto: "900",
      minRemainingCalls: 90,
      maxBreakEvenCalls: 90,
      requireBreakEvenWithinEntitlement: true,
      allowedServiceIds: ["research-api"],
      nowNs: "1000000000000000000",
    });
    expect(result.eligible).toBe(true);
    expect(result.metrics).toMatchObject({ breakEvenCalls: "85", remainingCalls: 100 });
  });

  it("rejects an advance above the spending cap", () => {
    const result = evaluateSeriesPolicy(series, {
      maxAdvanceYocto: "800",
      nowNs: "1000000000000000000",
    });
    expect(result.reasons).toContain("advance exceeds policy spending cap");
  });

  it("rejects services outside the allowlist", () => {
    const result = evaluateSeriesPolicy(series, {
      maxAdvanceYocto: "900",
      allowedServiceIds: ["account-risk"],
      nowNs: "1000000000000000000",
    });
    expect(result.reasons).toContain("service is not permitted by policy");
  });

  it("never recommends an already funded series", () => {
    const result = evaluateSeriesPolicy({ ...series, status: "FUNDED" }, {
      maxAdvanceYocto: "900",
      nowNs: "1000000000000000000",
    });
    expect(result.eligible).toBe(false);
  });
});
