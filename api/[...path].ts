import type { IncomingMessage, ServerResponse } from "node:http";
import { NearChain } from "../gateway/src/chain.js";
import { createGatewayHandler } from "../gateway/src/server.js";
import { researchNearAccount } from "../gateway/src/service.js";
import { SignedChallengeStore } from "../gateway/src/store.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const networkId = process.env.NEAR_NETWORK_ID ?? "testnet";
const contractId = process.env.CONTRACT_ID ?? "first100-v2-20261115.testnet";
const rpcUrls = (process.env.NEAR_RPC_URLS ?? "https://rpc.testnet.near.org,https://test.rpc.fastnear.com")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const chain = new NearChain(
  networkId,
  contractId,
  rpcUrls,
  required("GATEWAY_ACCOUNT_ID"),
  required("GATEWAY_PRIVATE_KEY"),
);
const store = new SignedChallengeStore(required("GATEWAY_CHALLENGE_SECRET"));
const gateway = createGatewayHandler({
  chain,
  store,
  runService: (request) => researchNearAccount(chain, request),
});

export default function handler(request: IncomingMessage, response: ServerResponse) {
  request.url = (request.url ?? "/").replace(/^\/api(?=\/|$)/, "") || "/";
  return gateway(request, response);
}
