export interface Series {
  id: string;
  service_id: string;
  seller: string;
  beneficiary_token_id: string;
  cap_n: number;
  settled_count: number;
  unit_price_yocto: string;
  advance_yocto: string;
  expires_at_ns: string;
  status: string;
  entitlement_complete: boolean;
}

export interface Token {
  token_id: string;
  owner_id: string;
  metadata?: { title?: string; description?: string };
}

export interface Order {
  id: string;
  series_id: string;
  buyer: string;
  request_hash: string;
  response_hash?: string;
  amount_yocto: string;
  confirm_deadline_ns: string;
  status: string;
}

export interface ActionProof {
  label: string;
  hash: string;
}
