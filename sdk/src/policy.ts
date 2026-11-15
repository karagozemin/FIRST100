export interface PolicySeries {
  id: string;
  service_id: string;
  status: string;
  cap_n: number;
  settled_count: number;
  advance_yocto: string;
  unit_price_yocto: string;
  expires_at_ns: string;
}

export interface InvestorPolicy {
  maxAdvanceYocto: string;
  minRemainingCalls?: number;
  maxBreakEvenCalls?: number;
  allowedServiceIds?: string[];
  requireBreakEvenWithinEntitlement?: boolean;
  nowNs?: string;
}

export interface PolicyEvaluation {
  eligible: boolean;
  reasons: string[];
  metrics: {
    breakEvenCalls: string;
    remainingCalls: number;
    maximumGrossYocto: string;
    maximumGrossMarginYocto: string;
  };
}

export function evaluateSeriesPolicy(series: PolicySeries, policy: InvestorPolicy): PolicyEvaluation {
  const reasons: string[] = [];
  const advance = BigInt(series.advance_yocto);
  const price = BigInt(series.unit_price_yocto);
  const maximumGross = price * BigInt(series.cap_n);
  const remaining = Math.max(0, series.cap_n - series.settled_count);
  if (price <= 0n) throw new Error("unit price must be positive");
  const breakEven = (advance + price - 1n) / price;
  const nowNs = BigInt(policy.nowNs ?? (BigInt(Date.now()) * 1_000_000n).toString());

  if (series.status !== "LISTED") reasons.push("series is not available for funding");
  if (BigInt(series.expires_at_ns) <= nowNs) reasons.push("series is expired");
  if (advance > BigInt(policy.maxAdvanceYocto)) reasons.push("advance exceeds policy spending cap");
  if (remaining < (policy.minRemainingCalls ?? 0)) reasons.push("remaining entitlement is below policy minimum");
  if (policy.maxBreakEvenCalls !== undefined && breakEven > BigInt(policy.maxBreakEvenCalls)) {
    reasons.push("break-even call count exceeds policy maximum");
  }
  if (policy.requireBreakEvenWithinEntitlement && breakEven > BigInt(remaining)) {
    reasons.push("break-even is outside the remaining entitlement");
  }
  if (policy.allowedServiceIds?.length && !policy.allowedServiceIds.includes(series.service_id)) {
    reasons.push("service is not permitted by policy");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      breakEvenCalls: breakEven.toString(),
      remainingCalls: remaining,
      maximumGrossYocto: maximumGross.toString(),
      maximumGrossMarginYocto: (maximumGross - advance).toString(),
    },
  };
}
