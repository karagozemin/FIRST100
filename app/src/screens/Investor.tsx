import { useEffect, useState } from "react";
import type { Wallet } from "@near-wallet-selector/core";
import { breakEvenCalls, evaluateSeriesPolicy, nearToYocto, yoctoToNear } from "@first100/sdk";
import { callMethod, rpc, transactionHash } from "../near";
import { Button, Field, Notice, Stat } from "../ui";
import type { ActionProof, Series } from "../types";

export function Investor({ wallet, record }: { wallet: Wallet | undefined; record: (proof: ActionProof) => void }) {
  const [seriesId, setSeriesId] = useState("first100-live-001");
  const [series, setSeries] = useState<Series>();
  const [listings, setListings] = useState<Series[]>([]);
  const [maxAdvance, setMaxAdvance] = useState("1");
  const [minRemaining, setMinRemaining] = useState("25");
  const [message, setMessage] = useState("");

  async function load(id = seriesId) {
    const result = await rpc.view<Series | null>("get_series", { series_id: id });
    setSeriesId(id);
    setSeries(result ?? undefined);
    if (!result) setMessage("Series not found on finalized chain state.");
  }
  async function browse() {
    try {
      const result = await rpc.view<Series[]>("get_series_page", {
        from_index: "0",
        limit: 20,
        status: null,
        seller: null,
        service_id: null,
      });
      setListings(result);
    } catch {
      setListings([]);
    }
  }
  useEffect(() => { void browse(); }, []);
  async function fund() {
    if (!wallet || !series) return;
    try {
      const outcome = await callMethod(wallet, "fund_series", { series_id: series.id }, series.advance_yocto);
      const hash = transactionHash(outcome);
      if (hash) record({ label: "fund_series", hash });
      setMessage("Funding finalized. The revenue-right NFT was minted to this wallet.");
      await load();
    } catch (error) { setMessage(String(error)); }
  }

  let policy;
  try {
    if (series) {
      policy = evaluateSeriesPolicy(series, {
        maxAdvanceYocto: nearToYocto(maxAdvance || "0"),
        minRemainingCalls: Math.max(0, Number(minRemaining || "0")),
        requireBreakEvenWithinEntitlement: true,
      });
    }
  } catch {
    policy = undefined;
  }

  return <section className="screen-grid">
    <div className="panel">
      <div className="eyebrow">02 · INVESTOR</div>
      <h2>Fund cashflow—not the company.</h2>
      <p className="lede">The NFT routes future confirmed sales at settlement time. It does not grant service ownership, API keys, or prior accruals.</p>
      <div className="inline-form"><Field label="Series ID" value={seriesId} onChange={setSeriesId} /><Button onClick={load} secondary>Load finalized state</Button></div>
      <div className="portfolio-head"><span>DISCOVERED SERIES</span><button onClick={() => void browse()}>REFRESH</button></div>
      <div className="series-list">
        {listings.length ? listings.map((item) => <button key={item.id} className={item.id === series?.id ? "selected" : ""} onClick={() => void load(item.id)}>
          <span>{item.service_id}</span><strong>{item.id}</strong><small>{item.status} · {item.settled_count}/{item.cap_n}</small>
        </button>) : <span className="series-list-empty">No indexed series returned yet.</span>}
      </div>
      {message && <p className="result-line">{message}</p>}
    </div>
    <div className="panel metric-panel">
      {series ? <>
        <div className="status-row"><span className={`status ${series.status.toLowerCase()}`}>{series.status}</span><code>{series.id}</code></div>
        <div className="stats">
          <Stat label="Advance" value={`${yoctoToNear(series.advance_yocto, 2)} Ⓝ`} accent />
          <Stat label="Per sale" value={`${yoctoToNear(series.unit_price_yocto, 2)} Ⓝ`} />
          <Stat label="Right" value={`${series.settled_count} / ${series.cap_n}`} />
          <Stat label="Break-even*" value={`${breakEvenCalls(series.advance_yocto, series.unit_price_yocto)} calls`} />
          <Stat label="Maximum gross*" value={`${yoctoToNear((BigInt(series.unit_price_yocto) * BigInt(series.cap_n)).toString(), 2)} Ⓝ`} />
          <Stat label="Remaining" value={`${Math.max(0, series.cap_n - series.settled_count)} calls`} />
        </div>
        <div className="form-grid policy-controls">
          <Field label="Policy max advance · NEAR" type="number" min="0" step="0.1" value={maxAdvance} onChange={setMaxAdvance} />
          <Field label="Minimum remaining calls" type="number" min="0" value={minRemaining} onChange={setMinRemaining} />
        </div>
        <Notice tone={policy?.eligible ? "ok" : "warn"}>{policy?.eligible ? "Terms pass the current spending and entitlement policy. Wallet approval is still required." : policy ? `Policy blocked: ${policy.reasons.join("; ")}.` : "Enter valid policy limits to evaluate this series."}</Notice>
        <Notice tone="warn">*Excludes gas, fees, time value, liquidity, and NEAR price risk. Sales may never happen.</Notice>
        <Button onClick={fund} disabled={!wallet || !policy?.eligible}>Fund exact advance & mint NFT</Button>
      </> : <div className="empty-state">Load a listing to inspect its exact onchain terms.</div>}
    </div>
  </section>;
}
