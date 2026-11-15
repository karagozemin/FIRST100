import { NearChain } from "./chain.js";
import { createDefaultServiceRegistry } from "./adapters.js";
import { createGatewayServer } from "./server.js";
import { JsonGatewayStore } from "./store.js";

const networkId = process.env.NEAR_NETWORK_ID ?? "testnet";
const contractId = process.env.CONTRACT_ID;
if (!contractId) throw new Error("CONTRACT_ID is required");
const rpcUrls = (process.env.NEAR_RPC_URLS ?? "https://rpc.testnet.near.org")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const chain = new NearChain(
  networkId,
  contractId,
  rpcUrls,
  process.env.GATEWAY_ACCOUNT_ID,
  process.env.GATEWAY_PRIVATE_KEY,
);
const store = new JsonGatewayStore(process.env.GATEWAY_DATA_FILE ?? "./gateway/data/state.json");
const services = createDefaultServiceRegistry(chain);
const server = createGatewayServer({
  chain,
  store,
  runService: (serviceId, request, context) => services.execute(serviceId, request, context),
  listServices: () => services.list(),
});
const port = Number(process.env.GATEWAY_PORT ?? 8787);
server.listen(port, "127.0.0.1", () => {
  console.log(`FIRST100 gateway listening on http://127.0.0.1:${port}`);
});
