import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { sha256 } from "./hash.js";
import type { GatewayStore } from "./store.js";
import type { ChainOrder, ResearchRequest, ResearchResult } from "./types.js";

export interface GatewayChain {
  readonly networkId: string;
  readonly contractId: string;
  getOrder(orderId: string): Promise<ChainOrder | null>;
  getSeries(seriesId: string): Promise<unknown>;
  getActiveSeries(serviceId: string): Promise<string | null>;
  verifyAccessKey(accountId: string, publicKey: string): Promise<void>;
  verifyWalletMessage(
    buyer: string,
    publicKey: string,
    message: string,
    nonceBase64: string,
    signatureBase64: string,
  ): Promise<void>;
  verifyPaymentTransaction(txHash: string, buyer: string, orderId: string): Promise<void>;
  submitDeliveryHash(orderId: string, responseHash: string): Promise<string>;
}

export interface GatewayDependencies {
  chain: GatewayChain;
  store: GatewayStore;
  runService(request: ResearchRequest): Promise<ResearchResult>;
  now?: () => number;
}

function send(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(data));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > 32_768) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${field} is required`);
  return value;
}

export function createGatewayServer(dependencies: GatewayDependencies) {
  const now = dependencies.now ?? Date.now;

  return createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") return send(response, 204, {});
      const url = new URL(request.url ?? "/", "http://gateway.local");

      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, {
          ok: true,
          version: "0.1.0",
          network: dependencies.chain.networkId,
          contractId: dependencies.chain.contractId,
          trustBoundary: "Payment/state are verified onchain; output quality is buyer-assessed.",
        });
      }

      const quote = url.pathname.match(/^\/services\/([^/]+)\/quote$/);
      if (request.method === "GET" && quote) {
        const serviceId = decodeURIComponent(quote[1]!);
        const seriesId = await dependencies.chain.getActiveSeries(serviceId);
        if (!seriesId) return send(response, 404, { error: "no active funded series" });
        return send(response, 200, await dependencies.chain.getSeries(seriesId));
      }

      const challengeRoute = url.pathname.match(/^\/orders\/([^/]+)\/challenge$/);
      if (request.method === "POST" && challengeRoute) {
        const orderId = decodeURIComponent(challengeRoute[1]!);
        const input = await body(request);
        const buyer = assertString(input.buyer, "buyer");
        const order = await dependencies.chain.getOrder(orderId);
        if (!order || order.buyer !== buyer) return send(response, 403, { error: "buyer/order mismatch" });
        if (order.status !== "PAID_PENDING") return send(response, 409, { error: "order is not executable" });
        const value = randomBytes(32).toString("base64");
        await dependencies.store.putChallenge({ orderId, buyer, value, expiresAt: now() + 300_000 });
        return send(response, 200, {
          challenge: value,
          message: `Authorize FIRST100 execution for order ${orderId}`,
          recipient: dependencies.chain.contractId,
          expiresInSeconds: 300,
        });
      }

      const executeRoute = url.pathname.match(/^\/orders\/([^/]+)\/execute$/);
      if (request.method === "POST" && executeRoute) {
        const orderId = decodeURIComponent(executeRoute[1]!);
        const input = await body(request);
        const buyer = assertString(input.buyer, "buyer");
        const publicKey = assertString(input.publicKey, "publicKey");
        const signature = assertString(input.signature, "signature");
        const challenge = assertString(input.challenge, "challenge");
        const paymentTxHash = assertString(input.paymentTxHash, "paymentTxHash");
        const serviceRequest = input.request as ResearchRequest;
        if (!serviceRequest || typeof serviceRequest.accountId !== "string") throw new Error("request.accountId is required");

        const accepted = await dependencies.store.consumeChallenge(orderId, buyer, challenge);
        if (!accepted) {
          return send(response, 401, { error: "invalid or expired wallet proof" });
        }
        try {
          await dependencies.chain.verifyWalletMessage(
            buyer,
            publicKey,
            `Authorize FIRST100 execution for order ${orderId}`,
            challenge,
            signature,
          );
        } catch {
          return send(response, 401, { error: "invalid NEP-413 wallet proof" });
        }
        const order = await dependencies.chain.getOrder(orderId);
        if (!order || order.buyer !== buyer || order.status !== "PAID_PENDING") {
          return send(response, 409, { error: "order is not paid and pending" });
        }
        if (sha256(serviceRequest) !== order.request_hash.toLowerCase()) {
          return send(response, 409, { error: "request hash does not match onchain commitment" });
        }
        await dependencies.chain.verifyPaymentTransaction(paymentTxHash, buyer, orderId);
        const existing = await dependencies.store.getExecution(orderId);
        if (existing) return send(response, 200, { ...existing, idempotentReplay: true });

        const output = await dependencies.runService(serviceRequest);
        const responseHash = sha256(output);
        const deliveryTxHash = await dependencies.chain.submitDeliveryHash(orderId, responseHash);
        const record = {
          orderId,
          buyer,
          paymentTxHash,
          requestHash: order.request_hash,
          responseHash,
          output,
          deliveryTxHash,
          executedAt: new Date(now()).toISOString(),
        };
        await dependencies.store.putExecution(record);
        return send(response, 200, record);
      }

      const statusRoute = url.pathname.match(/^\/orders\/([^/]+)\/status$/);
      if (request.method === "GET" && statusRoute) {
        const orderId = decodeURIComponent(statusRoute[1]!);
        const [order, execution] = await Promise.all([
          dependencies.chain.getOrder(orderId),
          dependencies.store.getExecution(orderId),
        ]);
        if (!order) return send(response, 404, { error: "order not found" });
        return send(response, 200, { order, execution: execution ?? null });
      }

      return send(response, 404, { error: "not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      return send(response, message.includes("required") || message.includes("invalid") ? 400 : 502, { error: message });
    }
  });
}
