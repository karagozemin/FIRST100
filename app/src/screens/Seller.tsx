import { useState } from "react";
import type { Wallet } from "@near-wallet-selector/core";
import { nearToYocto, sha256 } from "@first100/sdk";
import { callMethod, transactionHash } from "../near";
import { Button, Field, Notice } from "../ui";
import type { ActionProof } from "../types";

export function Seller({ wallet, accountId, record }: { wallet: Wallet | undefined; accountId: string | undefined; record: (proof: ActionProof) => void }) {
  const [serviceId, setServiceId] = useState("research-api");
  const [gateway, setGateway] = useState("gateway.first100-v2-20261115.testnet");
  const [endpoint, setEndpoint] = useState("https://first100-liard.vercel.app/api");
  const [seriesId, setSeriesId] = useState("first100-series-002");
  const [cap, setCap] = useState("100");
  const [unit, setUnit] = useState("0.01");
  const [advance, setAdvance] = useState("0.85");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function register() {
    if (!wallet || !accountId) return;
    setBusy(true);
    try {
      const outcome = await callMethod(wallet, "register_service", {
        service_id: serviceId,
        gateway,
        endpoint_commitment: await sha256({ endpoint }),
      }, nearToYocto("0.01"));
      const hash = transactionHash(outcome);
      if (hash) record({ label: "register_service", hash });
      setMessage("Service registered onchain.");
    } catch (error) { setMessage(String(error)); throw error; } finally { setBusy(false); }
  }

  async function listSeries() {
    if (!wallet || !accountId) return;
    setBusy(true);
    try {
      const expiresAt = BigInt(Date.now() + Number(days) * 86_400_000) * 1_000_000n;
      const outcome = await callMethod(wallet, "create_series", {
        series_id: seriesId,
        service_id: serviceId,
        cap_n: Number(cap),
        unit_price_yocto: nearToYocto(unit),
        advance_yocto: nearToYocto(advance),
        expires_at_ns: expiresAt.toString(),
        confirmation_timeout_ns: "900000000000",
      }, nearToYocto("0.02"));
      const hash = transactionHash(outcome);
      if (hash) record({ label: "create_series", hash });
      setMessage("Revenue series listed. It has no NFT until an investor funds it.");
    } catch (error) { setMessage(String(error)); throw error; } finally { setBusy(false); }
  }

  return <section className="screen-grid">
    <div className="panel">
      <div className="eyebrow">01 · SELLER</div>
      <h2>Turn bounded sales into runway.</h2>
      <p className="lede">Register the service route, then list only the first N buyer-confirmed sales. Your keys, company, and later revenue stay yours.</p>
      <div className="form-grid">
        <Field label="Service ID" value={serviceId} onChange={setServiceId} />
        <Field label="Gateway account" value={gateway} onChange={setGateway} hint="Must submit the delivery hash onchain." />
        <Field label="Committed endpoint" value={endpoint} onChange={setEndpoint} />
      </div>
      <Button onClick={register} disabled={busy || !wallet || !gateway} activityLabel="Registering service on NEAR" loadingLabel="Awaiting wallet">Register service · 0.01 NEAR</Button>
    </div>
    <div className="panel warm">
      <div className="form-grid">
        <Field label="Series ID" value={seriesId} onChange={setSeriesId} />
        <Field label="Successful sales cap" type="number" min="1" value={cap} onChange={setCap} />
        <Field label="Price per call · NEAR" type="number" step="0.01" value={unit} onChange={setUnit} />
        <Field label="Advance · NEAR" type="number" step="0.1" value={advance} onChange={setAdvance} />
        <Field label="Offer duration · days" type="number" min="1" value={days} onChange={setDays} />
      </div>
      <Notice tone="warn">This is not a loan or guaranteed yield. Only sales settled through this contract count.</Notice>
      <Button onClick={listSeries} disabled={busy || !wallet} activityLabel="Listing revenue series on NEAR" loadingLabel="Awaiting wallet">List series · 0.02 NEAR storage</Button>
      {message && <p key={message} className="result-line">{message}</p>}
    </div>
  </section>;
}
