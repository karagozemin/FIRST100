import evidence from "../../../evidence/testnet-transactions.json";
import { contractId, explorerBase } from "../near";
import type { ActionProof } from "../types";
import { Notice } from "../ui";

export function Proof({ sessionProofs }: { sessionProofs: ActionProof[] }) {
  const saved = Object.entries(evidence.transactions).map(([label, transaction]) => ({
    label,
    hash: transaction.hash,
  }));
  const proofs = [...saved, ...sessionProofs];
  return <section className="proof-layout">
    <div>
      <div className="eyebrow">05 · AUDITOR</div>
      <h2>Don’t trust the interface. Recompute it.</h2>
      <p className="lede">Every claim below resolves to a finalized transaction or direct contract view. Cached gateway output is never the accounting authority.</p>
      <Notice tone={evidence.status === "testnet" ? "ok" : "warn"}>
        Evidence status: <strong>{evidence.status}</strong>. {evidence.status !== "testnet" && "No deployment or transaction is claimed yet."}
      </Notice>
    </div>
    <div className="proof-stack">
      <div className="proof-row head"><span>Action</span><span>Finalized transaction</span></div>
      {proofs.length ? proofs.map((proof, index) => <a className="proof-row" key={`${proof.label}-${index}`} href={`${explorerBase}/txns/${proof.hash}`} target="_blank" rel="noreferrer">
        <span>{proof.label}</span><code>{proof.hash.slice(0, 12)}…{proof.hash.slice(-8)}</code>
      </a>) : <div className="empty-state">Deploy to testnet and run the walkthrough; real hashes will appear here. Placeholders are intentionally rejected.</div>}
      <a className="contract-link" href={`${explorerBase}/address/${contractId}`} target="_blank" rel="noreferrer">Open contract on explorer ↗</a>
    </div>
  </section>;
}
