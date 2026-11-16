import {
  setupWalletSelector,
  type ModuleState,
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

const meteorExtensionUrl = "https://chromewebstore.google.com/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb";

type WalletStatus = "READY" | "INSTALL" | "WEB" | "MOBILE" | "DEVICE" | "SNAP";

type ProviderWindow = Window & {
  bitkeep?: { near?: unknown };
  coin98?: unknown;
  dapp?: unknown;
  hotExtension?: unknown;
  meteorCom?: unknown;
  narwallets?: unknown;
  near?: { isSender?: boolean };
  nearWalletApi?: unknown;
  nightly?: { near?: unknown };
  okxwallet?: { near?: unknown };
  xfi?: { near?: unknown };
};

const extensionDetectors: Record<string, () => boolean> = {
  "bitget-wallet": () => Boolean(providerWindow().bitkeep?.near),
  "coin98-wallet": () => Boolean(providerWindow().coin98),
  "hot-wallet": () => Boolean(providerWindow().hotExtension),
  "math-wallet": () => Boolean(providerWindow().nearWalletApi),
  "meteor-wallet": () => Boolean(providerWindow().meteorCom),
  narwallets: () => Boolean(providerWindow().narwallets),
  nightly: () => Boolean(providerWindow().nightly?.near),
  "okx-wallet": () => Boolean(providerWindow().okxwallet?.near),
  sender: () => Boolean(providerWindow().near?.isSender),
  "welldone-wallet": () => Boolean(providerWindow().dapp),
  xdefi: () => Boolean(providerWindow().xfi?.near),
};

const webWalletIds = new Set([
  "arepa-wallet",
  "bitte-wallet",
  "here-wallet",
  "intear-wallet",
  "meteor-wallet-app",
  "ramper-wallet",
]);

function providerWindow() {
  return window as ProviderWindow;
}

function walletStatus(module: ModuleState): WalletStatus {
  const detectsExtension = extensionDetectors[module.id];
  if (detectsExtension) {
    const ready = detectsExtension();
    if (module.id === "hot-wallet") {
      module.metadata.available = true;
      return ready ? "READY" : "WEB";
    }
    module.metadata.available = ready;
    return ready ? "READY" : "INSTALL";
  }
  if (module.id === "near-snap") return "SNAP";
  if (module.id === "near-mobile-wallet") return "MOBILE";
  if (module.type === "hardware") return "DEVICE";
  if (module.type === "browser" || module.type === "instant-link" || webWalletIds.has(module.id)) return "WEB";
  return module.metadata.available ? "READY" : "INSTALL";
}

function walletDownloadUrl(module: ModuleState) {
  const value = (module.metadata as typeof module.metadata & { downloadUrl?: unknown }).downloadUrl;
  return typeof value === "string" && /^https:\/\//.test(value) ? value : undefined;
}

function openInstallPage(event: MouseEvent | KeyboardEvent) {
  const row = event.currentTarget as HTMLElement;
  if (row.dataset.walletStatus !== "install" || !row.dataset.installUrl) return;
  if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.open(row.dataset.installUrl, "_blank", "noopener,noreferrer");
}

function extensionAvailable(factory: WalletModuleFactory, check: () => boolean, downloadUrl?: string): WalletModuleFactory {
  return async (options) => {
    const module = await factory(options);
    if (!module) return null;
    module.metadata.available = check();
    if (downloadUrl) (module.metadata as typeof module.metadata & { downloadUrl?: string }).downloadUrl = downloadUrl;
    return module;
  };
}

function annotateWalletOptions(selector: WalletSelector) {
  const renderStatuses = () => {
    for (const module of selector.store.getState().modules) {
      const row = document.querySelector<HTMLElement>(`.single-wallet.sidebar.${CSS.escape(module.id)}`);
      if (!row) continue;
      const status = walletStatus(module);
      let badge = row.querySelector<HTMLElement>(".first100-wallet-status");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "first100-wallet-status";
        row.append(badge);
      }
      const normalizedStatus = status.toLowerCase();
      if (badge.dataset.status !== normalizedStatus) badge.dataset.status = normalizedStatus;
      if (badge.textContent !== status) badge.textContent = status;
      row.dataset.walletStatus = normalizedStatus;
      const installUrl = status === "INSTALL" ? walletDownloadUrl(module) : undefined;
      if (installUrl) row.dataset.installUrl = installUrl;
      else delete row.dataset.installUrl;
      if (!row.dataset.installNavigationBound) {
        row.addEventListener("click", openInstallPage, true);
        row.addEventListener("keydown", openInstallPage, true);
        row.dataset.installNavigationBound = "true";
      }
      const label = `${module.metadata.name} — ${status}`;
      if (row.getAttribute("aria-label") !== label) row.setAttribute("aria-label", label);
    }

    const installPanel = document.querySelector<HTMLElement>(".wallet-not-installed-wrapper");
    if (installPanel?.textContent?.includes("Meteor Wallet") && !installPanel.querySelector(".first100-wallet-help")) {
      const help = document.createElement("p");
      help.className = "first100-wallet-help";
      help.textContent = "Already installed? Allow Meteor Wallet to access this site, then refresh the page.";
      installPanel.append(help);
    }
  };

  const observer = new MutationObserver(renderStatuses);
  observer.observe(document.body, { childList: true, subtree: true });
  const refresh = window.setInterval(renderStatuses, 250);
  renderStatuses();
  window.setTimeout(() => {
    window.clearInterval(refresh);
    observer.disconnect();
  }, 5_000);
}

export function getWalletKit() {
  selectorPromise ??= setupWalletSelector({
    network: networkId,
    modules: [
      extensionAvailable(setupMeteorWallet(), extensionDetectors["meteor-wallet"]!, meteorExtensionUrl),
      setupMeteorWalletApp({ contractId }),
      extensionAvailable(setupNightly(), extensionDetectors.nightly!),
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

export async function showWalletModal() {
  const kit = await getWalletKit();
  kit.modal.show();
  annotateWalletOptions(kit.selector);
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
