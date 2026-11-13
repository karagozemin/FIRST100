import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { replayLedger, type LedgerEvent } from "./ledger.js";

interface Evidence {
  network: string;
  contractId: string;
  rpcUrl: string;
  status: "not-deployed" | "testnet";
  transactions: Record<string, string>;
}

async function rpc(url: string, method: string, params: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "first100-verifier", method, params }),
  });
  const body = await response.json() as { result?: unknown; error?: unknown };
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

async function view<T>(evidence: Evidence, methodName: string, args: Record<string, unknown>): Promise<T> {
  const result = await rpc(evidence.rpcUrl, "query", {
    request_type: "call_function",
    finality: "final",
    account_id: evidence.contractId,
    method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  }) as { result: number[] };
  return JSON.parse(Buffer.from(result.result).toString("utf8")) as T;
}

function terminalEvents(logs: string[]): LedgerEvent[] {
  const events: LedgerEvent[] = [];
  for (const log of logs) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    const envelope = JSON.parse(log.slice("EVENT_JSON:".length)) as {
      standard: string;
      event: string;
      data: Array<Record<string, unknown>>;
    };
    if (envelope.standard !== "first100") continue;
    for (const data of envelope.data) {
      if (envelope.event === "revenue_accrued") {
        events.push({
          event: "revenue_accrued",
          orderId: String(data.order_id),
          seriesId: String(data.series_id),
          beneficiary: String(data.beneficiary),
          amountYocto: String(data.amount_yocto),
          settledCount: Number(data.settled_count),
        });
      } else if (envelope.event === "order_refunded") {
        events.push({
          event: "order_refunded",
          orderId: String(data.order_id),
          buyer: String(data.buyer),
          amountYocto: String(data.amount_yocto),
        });
      }
    }
  }
  return events;
}

const evidencePath = resolve(process.cwd(), process.argv[2] ?? "evidence/testnet-transactions.json");
const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as Evidence;
if (evidence.status !== "testnet" || !evidence.contractId || evidence.contractId.includes("replace")) {
  console.error("Evidence is intentionally marked not-deployed. Deploy and record real hashes before claiming testnet proof.");
  process.exitCode = 2;
} else {
  const entries = Object.entries(evidence.transactions);
  if (entries.length === 0 || entries.some(([, hash]) => !hash || hash.includes("REAL_"))) {
    throw new Error("transaction evidence is incomplete");
  }
  const events: LedgerEvent[] = [];
  for (const [label, hash] of entries) {
    const result = await rpc(evidence.rpcUrl, "tx", { tx_hash: hash, wait_until: "FINAL" }) as {
      transaction?: { receiver_id?: string };
      status?: { Failure?: unknown };
      receipts_outcome?: Array<{ outcome?: { logs?: string[] } }>;
    };
    if (result.transaction?.receiver_id !== evidence.contractId) {
      throw new Error(`${label}: receiver is not ${evidence.contractId}`);
    }
    if (result.status?.Failure) throw new Error(`${label}: transaction failed`);
    events.push(...terminalEvents(result.receipts_outcome?.flatMap((receipt) => receipt.outcome?.logs ?? []) ?? []));
    console.log(`${label.padEnd(16)} ${hash} final=${JSON.stringify(result.status)}`);
  }
  if (events.length === 0) throw new Error("evidence contains no terminal settlement/refund events");

  const seriesIds = [...new Set(events.flatMap((event) => event.event === "revenue_accrued" ? [event.seriesId] : []))];
  const caps: Record<string, number> = {};
  for (const seriesId of seriesIds) {
    const series = await view<{ cap_n: number }>(evidence, "get_series", { series_id: seriesId });
    caps[seriesId] = series.cap_n;
  }
  const ledger = replayLedger(events, caps);
  const audit = await view<{ total_settled_revenue: string; total_refunds: string }>(evidence, "audit_totals", {});
  if (ledger.revenueYocto !== audit.total_settled_revenue || ledger.refundsYocto !== audit.total_refunds) {
    throw new Error("event replay does not reconcile with onchain audit totals; evidence may be incomplete");
  }
  console.log(`Verified ${entries.length} finalized transactions and replayed ${events.length} terminal events.`);
  console.log(`Revenue=${ledger.revenueYocto} refunds=${ledger.refundsYocto} contract=${evidence.contractId}`);
}
