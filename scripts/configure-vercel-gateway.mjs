import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { KeyPair } from "near-api-js";

const gatewayAccount = "gateway.first100-v2-20261115.testnet";
const contractAccount = "first100-v2-20261115.testnet";
const keyPair = KeyPair.fromRandom("ed25519");
const publicKey = keyPair.getPublicKey().toString();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
    input: options.input,
  });
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

run("npx", [
  "--yes", "near-cli-rs@0.30.1",
  "account", "add-key", gatewayAccount,
  "grant-function-call-access",
  "--allowance", "0.25 NEAR",
  "--contract-account-id", contractAccount,
  "--function-names", "submit_delivery_hash",
  "use-manually-provided-public-key", publicKey,
  "network-config", "testnet",
  "sign-with-keychain", "send",
]);

function setVercelEnvironment(name, value) {
  run("npx", ["vercel", "env", "add", name, "production", "--force"], { input: `${value}\n` });
}

setVercelEnvironment("NEAR_NETWORK_ID", "testnet");
setVercelEnvironment("CONTRACT_ID", contractAccount);
setVercelEnvironment("NEAR_RPC_URLS", "https://rpc.testnet.near.org,https://test.rpc.fastnear.com");
setVercelEnvironment("GATEWAY_ACCOUNT_ID", gatewayAccount);
setVercelEnvironment("GATEWAY_PRIVATE_KEY", keyPair.toString());
setVercelEnvironment("GATEWAY_CHALLENGE_SECRET", randomBytes(48).toString("base64url"));

console.log(`Configured a submit_delivery_hash-only key (${publicKey}) for the production gateway.`);
