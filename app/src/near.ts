import { setupWalletSelector, type WalletSelector, type Wallet } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { First100Rpc } from "@first100/sdk";
import { actionCreators } from "@near-js/transactions";

export const networkId = import.meta.env.VITE_NEAR_NETWORK_ID ?? "testnet";
export const contractId = import.meta.env.VITE_CONTRACT_ID ?? "first100-v2-20261115.testnet";
export const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8787";
export const rpcUrl = networkId === "mainnet" ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org";
export const explorerBase = networkId === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
export const rpc = new First100Rpc({ contractId, rpcUrls: [rpcUrl] });

let selectorPromise: Promise<{ selector: WalletSelector; modal: WalletSelectorModal }> | undefined;

export function getWalletKit() {
  selectorPromise ??= setupWalletSelector({
    network: networkId,
    modules: [setupMyNearWallet()],
  }).then((selector) => ({ selector, modal: setupModal(selector, { contractId }) }));
  return selectorPromise;
}

export async function callMethod(
  wallet: Wallet,
  methodName: string,
  args: Record<string, unknown>,
  deposit = "0",
) {
  return wallet.signAndSendTransaction({
    receiverId: contractId,
    actions: [actionCreators.functionCall(methodName, args, 50_000_000_000_000n, BigInt(deposit))],
  });
}

export function transactionHash(outcome: unknown): string | undefined {
  const value = outcome as { transaction?: { hash?: string } } | undefined;
  return value?.transaction?.hash;
}

export function successValue(outcome: unknown): unknown {
  const status = (outcome as { status?: { SuccessValue?: string } } | undefined)?.status;
  if (!status?.SuccessValue) return undefined;
  return JSON.parse(atob(status.SuccessValue));
}
