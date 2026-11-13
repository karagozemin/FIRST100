import { Account, JsonRpcProvider, KeyPairSigner } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import type { ChainOrder, ChainSeries } from "./types.js";

interface RpcEnvelope<T> { result?: T; error?: { message: string; data?: unknown } }

export class NearChain {
  private requestId = 0;

  constructor(
    readonly networkId: string,
    readonly contractId: string,
    private readonly rpcUrls: string[],
    private readonly gatewayAccountId?: string,
    private readonly gatewayPrivateKey?: string,
  ) {}

  private async rpc<T>(method: string, params: unknown): Promise<T> {
    let lastError: unknown;
    for (const url of this.rpcUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++this.requestId, method, params }),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
        const body = (await response.json()) as RpcEnvelope<T>;
        if (body.error) throw new Error(body.error.message);
        if (body.result === undefined) throw new Error("RPC result missing");
        return body.result;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`all NEAR RPC endpoints failed: ${String(lastError)}`);
  }

  async view<T>(methodName: string, args: Record<string, unknown>): Promise<T> {
    const result = await this.rpc<{ result: number[] }>("query", {
      request_type: "call_function",
      finality: "final",
      account_id: this.contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
    });
    return JSON.parse(Buffer.from(result.result).toString("utf8")) as T;
  }

  getOrder(orderId: string): Promise<ChainOrder | null> {
    return this.view("get_order", { order_id: orderId });
  }
  getSeries(seriesId: string): Promise<ChainSeries | null> {
    return this.view("get_series", { series_id: seriesId });
  }
  getActiveSeries(serviceId: string): Promise<string | null> {
    return this.view("get_active_series", { service_id: serviceId });
  }

  async verifyAccessKey(accountId: string, publicKey: string): Promise<void> {
    await this.rpc("query", {
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    });
  }

  async verifyWalletMessage(
    buyer: string,
    publicKey: string,
    message: string,
    nonceBase64: string,
    signatureBase64: string,
  ): Promise<void> {
    const nonce = Buffer.from(nonceBase64, "base64");
    if (nonce.length !== 32) throw new Error("NEP-413 nonce must be 32 bytes");
    await verifyMessage({
      signerAccountId: buyer,
      signerPublicKey: publicKey,
      payload: { message, recipient: this.contractId, nonce },
      signature: Buffer.from(signatureBase64, "base64"),
      provider: new JsonRpcProvider({ url: this.rpcUrls[0]! }),
    });
  }

  async verifyPaymentTransaction(txHash: string, buyer: string, orderId: string): Promise<void> {
    const tx = await this.rpc<{
      status: { SuccessValue?: string };
      transaction: { signer_id: string; receiver_id: string; actions: Array<{ FunctionCall?: { method_name: string } }> };
    }>("tx", { tx_hash: txHash, sender_account_id: buyer, wait_until: "FINAL" });
    if (tx.transaction.signer_id !== buyer || tx.transaction.receiver_id !== this.contractId) {
      throw new Error("payment transaction parties do not match");
    }
    if (!tx.transaction.actions.some((action) => action.FunctionCall?.method_name === "create_order")) {
      throw new Error("transaction is not a create_order call");
    }
    if (tx.status.SuccessValue === undefined) throw new Error("payment transaction failed");
    const returned = JSON.parse(Buffer.from(tx.status.SuccessValue, "base64").toString("utf8")) as string;
    if (returned !== orderId) throw new Error("payment transaction returned another order id");
  }

  async viewAccount(accountId: string): Promise<Record<string, unknown>> {
    return this.rpc("query", { request_type: "view_account", finality: "final", account_id: accountId });
  }

  async latestFinalBlock(): Promise<number> {
    const block = await this.rpc<{ header: { height: number } }>("block", { finality: "final" });
    return block.header.height;
  }

  async submitDeliveryHash(orderId: string, responseHash: string): Promise<string> {
    if (!this.gatewayAccountId || !this.gatewayPrivateKey) throw new Error("gateway signer is not configured");
    const provider = new JsonRpcProvider({ url: this.rpcUrls[0]! });
    const signer = KeyPairSigner.fromSecretKey(this.gatewayPrivateKey as `ed25519:${string}`);
    const account = new Account(this.gatewayAccountId, provider, signer);
    const outcome = await account.callFunctionRaw({
      contractId: this.contractId,
      methodName: "submit_delivery_hash",
      args: { order_id: orderId, response_hash: responseHash },
      gas: 30_000_000_000_000n,
      deposit: 0n,
      waitUntil: "FINAL",
    });
    return outcome.transaction.hash;
  }
}
