import {
  setupWalletSelector,
  type Wallet,
  type WalletModuleFactory,
  type WalletSelector,
} from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupArepaWallet } from "@near-wallet-selector/arepa-wallet";
import { setupBitgetWallet } from "@near-wallet-selector/bitget-wallet";
import { setupBitteWallet } from "@near-wallet-selector/bitte-wallet";
import { setupCoin98Wallet } from "@near-wallet-selector/coin98-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupHotWallet } from "@near-wallet-selector/hot-wallet";
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet";
import { setupLedger } from "@near-wallet-selector/ledger";
import { setupMathWallet } from "@near-wallet-selector/math-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupMeteorWalletApp } from "@near-wallet-selector/meteor-wallet-app";
import { setupNarwallets } from "@near-wallet-selector/narwallets";
import { setupNearMobileWallet } from "@near-wallet-selector/near-mobile-wallet";
import { setupNearSnap } from "@near-wallet-selector/near-snap";
import { setupNightly } from "@near-wallet-selector/nightly";
import { setupOKXWallet } from "@near-wallet-selector/okx-wallet";
import { setupRamperWallet } from "@near-wallet-selector/ramper-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupWelldoneWallet } from "@near-wallet-selector/welldone-wallet";
import { setupXDEFI } from "@near-wallet-selector/xdefi";
import { First100Rpc } from "@first100/sdk";
import { actionCreators } from "@near-js/transactions";

export const networkId = import.meta.env.VITE_NEAR_NETWORK_ID ?? "testnet";
export const contractId = import.meta.env.VITE_CONTRACT_ID ?? "first100-v2-20261115.testnet";
export const gatewayUrl = import.meta.env.VITE_GATEWAY_URL ?? (import.meta.env.DEV ? "http://localhost:8787" : "/api");
export const rpcUrl = networkId === "mainnet" ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org";
export const explorerBase = networkId === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
export const rpc = new First100Rpc({ contractId, rpcUrls: [rpcUrl] });

let selectorPromise: Promise<{ selector: WalletSelector; modal: WalletSelectorModal }> | undefined;

export function getWalletKit() {
  selectorPromise ??= setupWalletSelector({
    network: networkId,
    modules: [
      setupMeteorWallet(),
      setupMeteorWalletApp({ contractId }),
      setupNightly(),
      setupSender(),
      setupHotWallet(),
      setupHereWallet(),
      setupIntearWallet(),
      setupBitteWallet() as unknown as WalletModuleFactory,
      setupOKXWallet(),
      setupBitgetWallet(),
      setupCoin98Wallet(),
      setupNearSnap(),
      setupLedger(),
      setupNearMobileWallet(),
      setupArepaWallet(),
      setupMathWallet(),
      setupNarwallets(),
      setupRamperWallet(),
      setupWelldoneWallet(),
      setupXDEFI(),
    ],
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
