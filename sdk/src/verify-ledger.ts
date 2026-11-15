import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalJson } from "./index.js";
import { replayLedger, type LedgerEvent } from "./ledger.js";

interface Evidence {
  network: string;
  contractId: string;
  rpcUrl: string;
  status: "not-deployed" | "testnet";
  transactions: Record<string, EvidenceTransaction>;
}

interface EvidenceTransaction {
  hash: string;
  signerId: string;
}

interface ServiceReceipt {
  orderId: string;
  buyer: string;
  beneficiary: string;
  request: unknown;
  requestHash: string;
  response: unknown;
  responseHash: string;
  paymentTxHash: string;
  deliveryTxHash: string;
  confirmationTxHash: string;
}

interface ServiceEvidence {
  network: string;
  contractId: string;
  seriesId: string;
  receipts: ServiceReceipt[];
  refundProof: {
    orderId: string;
    buyer: string;
    paymentTxHash: string;
    refundTxHash: string;
    withdrawalTxHash: string;
  };
}

interface OrderView {
  buyer: string;
  request_hash: string;
  response_hash: string | null;
  status: "PAID_PENDING" | "DELIVERED" | "SETTLED" | "REFUNDED";
  beneficiary: string | null;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

async function rpc(url: string, method: string, params: unknown): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: `first100-verifier-${attempt}`, method, params }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
      const body = await response.json() as { result?: unknown; error?: unknown };
      if (body.error) throw new Error(JSON.stringify(body.error));
      if (body.result === undefined) throw new Error("RPC result missing");
      return body.result;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`RPC failed after three attempts: ${String(lastError)}`);
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
const serviceEvidence = JSON.parse(
  await readFile(resolve(dirname(evidencePath), "service-receipts.json"), "utf8"),
) as ServiceEvidence;
if (evidence.status !== "testnet" || !evidence.contractId || evidence.contractId.includes("replace")) {
  console.error("Evidence is intentionally marked not-deployed. Deploy and record real hashes before claiming testnet proof.");
  process.exitCode = 2;
} else {
  const entries = Object.entries(evidence.transactions);
  if (entries.length === 0 || entries.some(([, tx]) =>
    !tx.hash || tx.hash.includes("REAL_") || !tx.signerId
  )) {
    throw new Error("transaction evidence is incomplete");
  }
  const events: LedgerEvent[] = [];
  for (const [label, tx] of entries) {
    const result = await rpc(evidence.rpcUrl, "tx", {
      tx_hash: tx.hash,
      sender_account_id: tx.signerId,
      wait_until: "FINAL",
    }) as {
      transaction?: { receiver_id?: string };
      status?: { Failure?: unknown };
      receipts_outcome?: Array<{ outcome?: { logs?: string[] } }>;
    };
    if (result.transaction?.receiver_id !== evidence.contractId) {
      throw new Error(`${label}: receiver is not ${evidence.contractId}`);
    }
    if (result.status?.Failure) throw new Error(`${label}: transaction failed`);
    events.push(...terminalEvents(result.receipts_outcome?.flatMap((receipt) => receipt.outcome?.logs ?? []) ?? []));
    console.log(`${label.padEnd(16)} ${tx.hash} final=${JSON.stringify(result.status)}`);
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
  if (serviceEvidence.network !== evidence.network || serviceEvidence.contractId !== evidence.contractId) {
    throw new Error("service receipt network or contract does not match the transaction manifest");
  }
  const manifestHashes = new Set(entries.map(([, tx]) => tx.hash));
  for (const receipt of serviceEvidence.receipts) {
    if (digest(receipt.request) !== receipt.requestHash || digest(receipt.response) !== receipt.responseHash) {
      throw new Error(`${receipt.orderId}: service receipt commitment mismatch`);
    }
    for (const hash of [receipt.paymentTxHash, receipt.deliveryTxHash, receipt.confirmationTxHash]) {
      if (!manifestHashes.has(hash)) throw new Error(`${receipt.orderId}: receipt transaction is absent from manifest`);
    }
    const order = await view<OrderView>(evidence, "get_order", { order_id: receipt.orderId });
    if (
      order.status !== "SETTLED" ||
      order.buyer !== receipt.buyer ||
      order.beneficiary !== receipt.beneficiary ||
      order.request_hash !== receipt.requestHash ||
      order.response_hash !== receipt.responseHash
    ) {
      throw new Error(`${receipt.orderId}: service receipt does not match finalized order state`);
    }
  }
  const refund = serviceEvidence.refundProof;
  for (const hash of [refund.paymentTxHash, refund.refundTxHash, refund.withdrawalTxHash]) {
    if (!manifestHashes.has(hash)) throw new Error("refund proof transaction is absent from manifest");
  }
  const refundedOrder = await view<OrderView>(evidence, "get_order", { order_id: refund.orderId });
  if (refundedOrder.status !== "REFUNDED" || refundedOrder.buyer !== refund.buyer) {
    throw new Error("refund proof does not match finalized order state");
  }
  console.log(`Verified ${entries.length} finalized transactions and replayed ${events.length} terminal events.`);
  console.log(`Verified ${serviceEvidence.receipts.length} service receipts and one timeout refund proof.`);
  console.log(`Revenue=${ledger.revenueYocto} refunds=${ledger.refundsYocto} contract=${evidence.contractId}`);
}
