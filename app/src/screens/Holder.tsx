import { useState } from "react";
import type { Wallet } from "@near-wallet-selector/core";
import { yoctoToNear } from "@first100/sdk";
import { callMethod, rpc, transactionHash } from "../near";
import { Button, Field, Notice, Stat } from "../ui";
import type { ActionProof, Series, Token } from "../types";

export function Holder({ wallet, accountId, record }: { wallet: Wallet | undefined; accountId: string | undefined; record: (proof: ActionProof) => void }) {
  const [seriesId, setSeriesId] = useState("first100-live-001");
  const [receiver, setReceiver] = useState("");
  const [series, setSeries] = useState<Series>();
  const [token, setToken] = useState<Token>();
  const [credit, setCredit] = useState("0");
  const [message, setMessage] = useState("");

  async function load() {
    const found = await rpc.view<Series | null>("get_series", { series_id: seriesId });
    if (!found) return setMessage("Series not found.");
    const [nft, userCredit] = await Promise.all([
      rpc.view<Token | null>("nft_token", { token_id: found.beneficiary_token_id }),
      accountId ? rpc.view<string>("get_credit", { account_id: accountId }) : Promise.resolve("0"),
    ]);
    setSeries(found); setToken(nft ?? undefined); setCredit(userCredit); setMessage("");
  }
  async function transfer() {
    if (!wallet || !series || !receiver) return;
    const outcome = await callMethod(wallet, "nft_transfer", {
      receiver_id: receiver, token_id: series.beneficiary_token_id, approval_id: null,
      memo: "FIRST100 future revenue-right transfer",
    }, "1");
    const hash = transactionHash(outcome); if (hash) record({ label: "nft_transfer", hash });
    setMessage("NFT transferred. Existing credits remained with their original accounts."); await load();
  }
  async function withdraw() {
    if (!wallet) return;
    const outcome = await callMethod(wallet, "withdraw", { amount: null }, "1");
    const hash = transactionHash(outcome); if (hash) record({ label: "withdraw", hash });
    setMessage("Withdrawal started. The callback restores credit exactly once if the transfer fails.");
  }

  return <section className="screen-grid">
    <div className="panel">
      <div className="eyebrow">04 · HOLDER</div>
      <h2>Own the right. Keep prior cashflow separate.</h2>
      <div className="inline-form"><Field label="Series ID" value={seriesId} onChange={setSeriesId} /><Button onClick={load} secondary>Load rights</Button></div>
      {series && <div className="stats compact">
        <Stat label="Current owner" value={token?.owner_id ?? "not minted"} />
        <Stat label="Settled entitlement" value={`${series.settled_count} / ${series.cap_n}`} />
        <Stat label="Your withdrawable credit" value={`${yoctoToNear(credit, 4)} Ⓝ`} accent />
      </div>}
      {message && <p className="result-line">{message}</p>}
    </div>
    <div className="panel warm">
      <Field label="Transfer future rights to" value={receiver} onChange={setReceiver} hint="Only future settlements follow the NFT." />
      <Notice tone="warn">Previously accrued balances do not move. A transfer changes only the beneficiary read at later settlement.</Notice>
      <div className="button-row"><Button onClick={transfer} disabled={!wallet || !series || !receiver}>Transfer NFT · 1 yoctoⓃ</Button><Button onClick={withdraw} disabled={!wallet || credit === "0"} secondary>Withdraw all credit</Button></div>
    </div>
  </section>;
}
