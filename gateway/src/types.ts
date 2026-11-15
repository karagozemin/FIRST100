export type OrderStatus = "PAID_PENDING" | "DELIVERED" | "SETTLED" | "REFUNDED";

export interface ChainOrder {
  id: string;
  series_id: string;
  buyer: string;
  request_hash: string;
  response_hash: string | null;
  amount_yocto: string;
  confirm_deadline_ns: string;
  status: OrderStatus;
}

export interface ChainSeries {
  id: string;
  service_id: string;
  seller: string;
  beneficiary_token_id: string;
  cap_n: number;
  settled_count: number;
  unit_price_yocto: string;
  advance_yocto: string;
  expires_at_ns: string;
  status: "LISTED" | "FUNDED" | "CANCELLED" | "CLOSED";
  entitlement_complete: boolean;
}

export interface ResearchRequest {
  accountId: string;
}

export interface ResearchResult {
  kind: "near-account-research";
  accountId: string;
  network: string;
  blockHeight: number;
  amountYocto: string;
  lockedYocto: string;
  storageUsageBytes: number;
  codeHash: string;
  classification: "contract" | "account";
  summary: string;
  source: "finalized-near-rpc";
}

export interface ExecutionRecord {
  orderId: string;
  buyer: string;
  paymentTxHash: string;
  requestHash: string;
  responseHash: string;
  output: unknown;
  deliveryTxHash: string;
  executedAt: string;
}
