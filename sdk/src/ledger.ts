export interface RevenueAccruedEvent {
  event: "revenue_accrued";
  orderId: string;
  seriesId: string;
  beneficiary: string;
  amountYocto: string;
  settledCount: number;
}

export interface RefundEvent {
  event: "order_refunded";
  orderId: string;
  buyer: string;
  amountYocto: string;
}

export type LedgerEvent = RevenueAccruedEvent | RefundEvent;

export interface LedgerReplay {
  credits: Record<string, string>;
  settledBySeries: Record<string, number>;
  settledOrders: string[];
  refundedOrders: string[];
  revenueYocto: string;
  refundsYocto: string;
}

export function replayLedger(events: LedgerEvent[], caps: Record<string, number>): LedgerReplay {
  const credits = new Map<string, bigint>();
  const settledBySeries = new Map<string, number>();
  const terminal = new Set<string>();
  const settledOrders: string[] = [];
  const refundedOrders: string[] = [];
  let revenue = 0n;
  let refunds = 0n;

  for (const item of events) {
    if (terminal.has(item.orderId)) throw new Error(`order ${item.orderId} has multiple terminal outcomes`);
    terminal.add(item.orderId);
    if (item.event === "revenue_accrued") {
      const amount = BigInt(item.amountYocto);
      if (amount <= 0n) throw new Error("settlement amount must be positive");
      const previous = settledBySeries.get(item.seriesId) ?? 0;
      if (item.settledCount < previous || item.settledCount > (caps[item.seriesId] ?? 0)) {
        throw new Error(`series ${item.seriesId} count violates its cap`);
      }
      settledBySeries.set(item.seriesId, item.settledCount);
      credits.set(item.beneficiary, (credits.get(item.beneficiary) ?? 0n) + amount);
      revenue += amount;
      settledOrders.push(item.orderId);
    } else {
      const amount = BigInt(item.amountYocto);
      if (amount <= 0n) throw new Error("refund amount must be positive");
      credits.set(item.buyer, (credits.get(item.buyer) ?? 0n) + amount);
      refunds += amount;
      refundedOrders.push(item.orderId);
    }
  }
  return {
    credits: Object.fromEntries([...credits].map(([account, amount]) => [account, amount.toString()])),
    settledBySeries: Object.fromEntries(settledBySeries),
    settledOrders,
    refundedOrders,
    revenueYocto: revenue.toString(),
    refundsYocto: refunds.toString(),
  };
}
