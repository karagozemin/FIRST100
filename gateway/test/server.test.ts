import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { sha256 } from "../src/hash.js";
import { createGatewayServer, type GatewayChain } from "../src/server.js";
import { MemoryGatewayStore } from "../src/store.js";
import type { ChainOrder, ResearchRequest, ResearchResult } from "../src/types.js";

const requestPayload = { accountId: "alice.testnet" };
const order: ChainOrder = {
  id: "order-1",
  series_id: "series-1",
  buyer: "buyer.testnet",
  request_hash: sha256(requestPayload),
  response_hash: null,
  amount_yocto: "100",
  confirm_deadline_ns: "9999999999999999",
  status: "PAID_PENDING",
};

describe("FIRST100 gateway", () => {
  let server: Server;
  let baseUrl: string;
  let chain: GatewayChain;
  let runService: ReturnType<typeof vi.fn<(serviceId: string, request: ResearchRequest) => Promise<ResearchResult>>>;

  beforeEach(async () => {
    chain = {
      networkId: "testnet",
      contractId: "first100.testnet",
      getOrder: vi.fn(async (id) => (id === order.id ? { ...order } : null)),
      getSeries: vi.fn(async () => ({ id: "series-1", service_id: "research-api", unit_price_yocto: "100" })),
      getActiveSeries: vi.fn(async (id) => (id === "service-1" ? "series-1" : null)),
      verifyAccessKey: vi.fn(async () => undefined),
      verifyWalletMessage: vi.fn(async () => undefined),
      verifyPaymentTransaction: vi.fn(async () => undefined),
      acquireExecutionLease: vi.fn(async () => "lease-tx"),
      releaseExecutionLease: vi.fn(async () => "release-tx"),
      submitDeliveryHash: vi.fn(async () => "delivery-tx"),
    };
    runService = vi.fn(async (_serviceId, request) => ({
      kind: "near-account-research",
      accountId: request.accountId,
      network: "testnet",
      blockHeight: 123,
      amountYocto: "1",
      lockedYocto: "0",
      storageUsageBytes: 100,
      codeHash: "11111111111111111111111111111111",
      classification: "account",
      summary: "finalized account data",
      source: "finalized-near-rpc",
    }));
    server = createGatewayServer({
      chain,
      store: new MemoryGatewayStore(),
      runService,
      now: Date.now,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  async function issueChallenge(buyer = "buyer.testnet") {
    const response = await fetch(`${baseUrl}/orders/order-1/challenge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buyer, publicKey: "ed25519:public-key" }),
    });
    return { response, body: await response.json() as { challenge: string } };
  }

  async function execute(challenge: string, request: ResearchRequest = requestPayload) {
    return fetch(`${baseUrl}/orders/order-1/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        buyer: "buyer.testnet",
        publicKey: "ed25519:public-key",
        signature: "signed",
        challenge,
        paymentTxHash: "payment-tx",
        request,
      }),
    });
  }

  it("reports runtime and chain health", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, network: "testnet", contractId: "first100.testnet" });
  });

  it("returns a live quote from contract views", async () => {
    const response = await fetch(`${baseUrl}/services/service-1/quote`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "series-1", unit_price_yocto: "100" });
  });

  it("lists configured service adapters", async () => {
    const listedServer = createGatewayServer({
      chain,
      store: new MemoryGatewayStore(),
      runService,
      listServices: () => [{
        id: "research-api",
        version: "1.0.0",
        title: "Research",
        requestSchema: { type: "object" },
        metering: "per-call",
        source: "finalized-near-rpc",
      }],
    });
    await new Promise<void>((resolve) => listedServer.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(listedServer.address() as AddressInfo).port}`;
    const response = await fetch(`${url}/services`);
    expect(await response.json()).toMatchObject({ services: [{ id: "research-api" }] });
    await new Promise<void>((resolve, reject) => listedServer.close((error) => error ? reject(error) : resolve()));
  });

  it("rejects a challenge when wallet and order buyer differ", async () => {
    const { response } = await issueChallenge("attacker.testnet");
    expect(response.status).toBe(403);
  });

  it("executes a paid request and commits the response hash", async () => {
    const { body } = await issueChallenge();
    const response = await execute(body.challenge);
    const result = await response.json() as { responseHash: string; deliveryTxHash: string };
    expect(response.status).toBe(200);
    expect(result.responseHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.deliveryTxHash).toBe("delivery-tx");
    expect(runService).toHaveBeenCalledTimes(1);
    expect(runService).toHaveBeenCalledWith("research-api", requestPayload, {
      orderId: "order-1",
      seriesId: "series-1",
      serviceId: "research-api",
    });
    expect(chain.verifyPaymentTransaction).toHaveBeenCalledWith("payment-tx", "buyer.testnet", "order-1");
    expect(chain.acquireExecutionLease).toHaveBeenCalledWith("order-1", expect.stringMatching(/^[a-f0-9]{32}$/), "300000000000");
    expect(chain.submitDeliveryHash).toHaveBeenCalledWith("order-1", result.responseHash, expect.stringMatching(/^[a-f0-9]{32}$/));
  });

  it("is idempotent across authenticated execute retries", async () => {
    const firstChallenge = await issueChallenge();
    expect((await execute(firstChallenge.body.challenge)).status).toBe(200);
    const secondChallenge = await issueChallenge();
    const response = await execute(secondChallenge.body.challenge);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ idempotentReplay: true });
    expect(runService).toHaveBeenCalledTimes(1);
  });

  it("rejects payloads that do not match the onchain request hash", async () => {
    const { body } = await issueChallenge();
    const response = await execute(body.challenge, { accountId: "mallory.testnet" });
    expect(response.status).toBe(409);
    expect(runService).not.toHaveBeenCalled();
  });

  it("rejects a parallel worker when the onchain lease is held", async () => {
    vi.mocked(chain.acquireExecutionLease).mockRejectedValueOnce(new Error("order execution is already leased"));
    const { body } = await issueChallenge();
    const response = await execute(body.challenge);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "order execution is already in progress" });
    expect(runService).not.toHaveBeenCalled();
  });

  it("releases its lease when service execution fails", async () => {
    runService.mockRejectedValueOnce(new Error("service unavailable"));
    const { body } = await issueChallenge();
    const response = await execute(body.challenge);
    expect(response.status).toBe(502);
    expect(chain.releaseExecutionLease).toHaveBeenCalledWith("order-1", expect.stringMatching(/^[a-f0-9]{32}$/));
  });

  it("exposes onchain and execution status without treating cache as authority", async () => {
    const response = await fetch(`${baseUrl}/orders/order-1/status`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ order: { id: "order-1" }, execution: null });
  });
});
