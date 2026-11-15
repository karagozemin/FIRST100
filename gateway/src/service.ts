import type { NearChain } from "./chain.js";
import type { ResearchRequest, ResearchResult } from "./types.js";

const ACCOUNT_PATTERN = /^(?=.{2,64}$)([a-z0-9]+[-_])*[a-z0-9]+(\.([a-z0-9]+[-_])*[a-z0-9]+)*$/;

export async function researchNearAccount(
  chain: Pick<NearChain, "viewAccount" | "latestFinalBlock" | "networkId">,
  request: ResearchRequest,
): Promise<ResearchResult> {
  if (!ACCOUNT_PATTERN.test(request.accountId)) throw new Error("invalid NEAR account id");
  const [account, blockHeight] = await Promise.all([
    chain.viewAccount(request.accountId),
    chain.latestFinalBlock(),
  ]);
  const codeHash = String(account.code_hash ?? "");
  const classification = codeHash === "11111111111111111111111111111111" ? "account" : "contract";
  const amountYocto = String(account.amount ?? "0");
  const lockedYocto = String(account.locked ?? "0");
  const storageUsageBytes = Number(account.storage_usage ?? 0);
  const article = classification === "account" ? "an" : "a";
  return {
    kind: "near-account-research",
    accountId: request.accountId,
    network: chain.networkId,
    blockHeight,
    amountYocto,
    lockedYocto,
    storageUsageBytes,
    codeHash,
    classification,
    summary: `${request.accountId} is ${article} ${classification} with ${storageUsageBytes} bytes of onchain storage at finalized block ${blockHeight}.`,
    source: "finalized-near-rpc",
  };
}
