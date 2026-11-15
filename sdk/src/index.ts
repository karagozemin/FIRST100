export interface RpcConfig {
  contractId: string;
  rpcUrls: string[];
}

export class First100Rpc {
  private id = 0;
  constructor(private readonly config: RpcConfig) {}

  async view<T>(method: string, args: Record<string, unknown>): Promise<T> {
    let lastError: unknown;
    for (const rpcUrl of this.config.rpcUrls) {
      try {
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: ++this.id,
            method: "query",
            params: {
              request_type: "call_function",
              finality: "final",
              account_id: this.config.contractId,
              method_name: method,
              args_base64: encodeBase64(JSON.stringify(args)),
            },
          }),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
        const body = await response.json() as {
          result?: { result: number[] };
          error?: { message: string };
        };
        if (body.error) throw new Error(body.error.message);
        if (!body.result) throw new Error("RPC result missing");
        return JSON.parse(new TextDecoder().decode(Uint8Array.from(body.result.result))) as T;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`all RPC endpoints failed: ${String(lastError)}`);
  }
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function nearToYocto(value: string): string {
  if (!/^\d+(\.\d{0,24})?$/.test(value)) throw new Error("invalid NEAR amount");
  const [whole = "0", fractional = ""] = value.split(".");
  return (BigInt(whole) * 10n ** 24n + BigInt(fractional.padEnd(24, "0"))).toString();
}

export function yoctoToNear(value: string, decimals = 4): string {
  const amount = BigInt(value);
  const whole = amount / 10n ** 24n;
  const fraction = (amount % 10n ** 24n).toString().padStart(24, "0").slice(0, decimals);
  return decimals > 0 ? `${whole}.${fraction}` : whole.toString();
}

export function breakEvenCalls(advanceYocto: string, unitPriceYocto: string): bigint {
  const advance = BigInt(advanceYocto);
  const unit = BigInt(unitPriceYocto);
  if (unit <= 0n) throw new Error("unit price must be positive");
  return (advance + unit - 1n) / unit;
}

export { evaluateSeriesPolicy } from "./policy.js";
export type { InvestorPolicy, PolicyEvaluation, PolicySeries } from "./policy.js";

function encodeBase64(value: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(value).toString("base64");
  return btoa(unescape(encodeURIComponent(value)));
}
