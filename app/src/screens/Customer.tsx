import { useState } from "react";
import type { Wallet } from "@near-wallet-selector/core";
import { sha256, yoctoToNear } from "@first100/sdk";
import { callMethod, contractId, gatewayUrl, rpc, successValue, transactionHash } from "../near";
import { Button, Field, Notice } from "../ui";
import type { ActionProof, Order, Series } from "../types";

type SignedMessage = { accountId: string; publicKey: string; signature: string };

export function Customer({ wallet, accountId, record }: { wallet: Wallet | undefined; accountId: string | undefined; record: (proof: ActionProof) => void }) {
  const [seriesId, setSeriesId] = useState("first100-live-001");
  const [target, setTarget] = useState("first100-v2-20261115.testnet");
  const [series, setSeries] = useState<Series>();
  const [orderId, setOrderId] = useState("");
  const [responseHash, setResponseHash] = useState("");
  const [paymentHash, setPaymentHash] = useState("");
  const [output, setOutput] = useState<unknown>();
  const [order, setOrder] = useState<Order>();
  const [message, setMessage] = useState("");

  async function quote() {
    try {
      const found = (await rpc.view<Series | null>("get_series", { series_id: seriesId })) ?? undefined;
      setSeries(found);
      setMessage(found ? "Finalized series terms loaded." : "Series not found on finalized chain state.");
    } catch (error) { setMessage(String(error)); throw error; }
  }
  async function pay() {
    if (!wallet || !accountId || !series) return;
    try {
      const request = { accountId: target };
      const outcome = await callMethod(wallet, "create_order", {
        series_id: series.id,
        request_hash: await sha256(request),
        client_nonce: crypto.randomUUID(),
      }, series.unit_price_yocto);
      const id = successValue(outcome);
      const txHash = transactionHash(outcome);
      if (typeof id !== "string" || !txHash) throw new Error("wallet did not return finalized order evidence");
      setOrderId(id);
      setPaymentHash(txHash);
      record({ label: "create_order", hash: txHash });
      setMessage("Payment finalized. Sign a one-time NEP-413 challenge to unlock execution.");
      await loadOrder(id);
    } catch (error) { setMessage(String(error)); throw error; }
  }
  async function execute() {
    if (!wallet || !accountId || !orderId) return;
    try {
      if (!wallet.signMessage) throw new Error("This wallet does not support NEP-413 message signing.");
      const challengeResponse = await fetch(`${gatewayUrl}/orders/${orderId}/challenge`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ buyer: accountId }),
      });
      const challenge = await challengeResponse.json() as { challenge: string; message: string; recipient: string; error?: string };
      if (!challengeResponse.ok) throw new Error(challenge.error ?? "challenge failed");
      const nonce = Uint8Array.from(atob(challenge.challenge), (char) => char.charCodeAt(0));
      const signed = await wallet.signMessage({
        message: challenge.message,
        recipient: challenge.recipient,
        nonce: nonce as Buffer,
        callbackUrl: window.location.href,
      }) as SignedMessage | void;
      if (!signed) throw new Error("message signature was cancelled");
      const response = await fetch(`${gatewayUrl}/orders/${orderId}/execute`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          buyer: signed.accountId,
          publicKey: signed.publicKey,
          signature: signed.signature,
          challenge: challenge.challenge,
          paymentTxHash: paymentHash,
          request: { accountId: target },
        }),
      });
      const result = await response.json() as { output?: unknown; responseHash?: string; deliveryTxHash?: string; error?: string };
      if (!response.ok || !result.responseHash) throw new Error(result.error ?? "execution failed");
      setOutput(result.output);
      setResponseHash(result.responseHash);
      if (result.deliveryTxHash) record({ label: "submit_delivery", hash: result.deliveryTxHash });
      setMessage("Real finalized NEAR data returned. Review it before confirming delivery.");
    } catch (error) { setMessage(String(error)); throw error; }
  }
  async function confirm() {
    if (!wallet || !orderId || !responseHash) return;
    try {
      const outcome = await callMethod(wallet, "confirm_delivery", { order_id: orderId, response_hash: responseHash });
      const hash = transactionHash(outcome);
      if (hash) record({ label: "confirm_delivery", hash });
      setMessage("Delivery confirmed; revenue accrued to the NFT owner at this settlement moment.");
      await loadOrder(orderId);
    } catch (error) { setMessage(String(error)); throw error; }
  }
  async function loadOrder(id = orderId) {
    if (!id) return;
    try {
      const found = await rpc.view<Order | null>("get_order", { order_id: id });
      setOrder(found ?? undefined);
      if (!found) setMessage("Order not found on finalized chain state.");
    } catch (error) { setMessage(String(error)); throw error; }
  }
  async function refund() {
    if (!wallet || !orderId) return;
    try {
      const outcome = await callMethod(wallet, "claim_refund", { order_id: orderId });
      const hash = transactionHash(outcome);
      if (hash) record({ label: "claim_refund", hash });
      setMessage("Refund finalized as withdrawable buyer credit.");
      await loadOrder(orderId);
    } catch (error) { setMessage(String(error)); throw error; }
  }

  return <section className="screen-grid customer">
    <div className="panel">
      <div className="eyebrow">03 · CUSTOMER</div>
      <h2>Pay. Run. Inspect. Confirm.</h2>
      <p className="lede">The gateway executes only after finalized onchain payment. The response hash proves integrity—not usefulness—so you remain the confirmer.</p>
      <div className="form-grid">
        <Field label="Revenue series" value={seriesId} onChange={setSeriesId} />
        <Field label="NEAR account to research" value={target} onChange={setTarget} />
      </div>
      <div className="button-row"><Button onClick={quote} secondary activityLabel="Loading finalized service quote">Get quote</Button><Button onClick={pay} disabled={!wallet || !series} activityLabel="Creating paid onchain order" loadingLabel="Awaiting wallet">Pay {series ? `${yoctoToNear(series.unit_price_yocto, 2)} Ⓝ` : "onchain"}</Button></div>
      {orderId && <code className="order-id">Order · {orderId}{order ? ` · ${order.status}` : ""}</code>}
      {message && <p key={message} className="result-line">{message}</p>}
    </div>
    <div className="panel output-panel">
      {!output ? <div className="empty-state"><span className="pulse" />Payment-gated account research appears here.</div> : <pre className="output-reveal">{JSON.stringify(output, null, 2)}</pre>}
      <div className="button-row">
        <Button onClick={execute} disabled={!orderId || Boolean(output)} activityLabel="Authorizing and running paid API" loadingLabel="Executing">Run paid API</Button>
        <Button onClick={confirm} disabled={!responseHash} activityLabel="Confirming delivery and settling revenue" loadingLabel="Awaiting wallet">Confirm delivery</Button>
        <Button onClick={() => loadOrder()} disabled={!orderId} secondary activityLabel="Refreshing finalized order state">Refresh order</Button>
        <Button onClick={refund} disabled={!orderId || order?.status === "SETTLED" || order?.status === "REFUNDED"} secondary activityLabel="Claiming timed-out order refund" loadingLabel="Awaiting wallet">Claim timed-out refund</Button>
      </div>
      <Notice>Refund becomes available only after the onchain confirmation deadline. Buyer acknowledgement remains an explicit trust boundary.</Notice>
    </div>
  </section>;
}
