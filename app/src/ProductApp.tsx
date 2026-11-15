import { useEffect, useState } from "react";
import type { Wallet } from "@near-wallet-selector/core";
import logo from "../../first100-logo.png";
import { contractId, explorerBase, getWalletKit, networkId, rpc } from "./near";
import { Seller } from "./screens/Seller";
import { Investor } from "./screens/Investor";
import { Customer } from "./screens/Customer";
import { Holder } from "./screens/Holder";
import { Proof } from "./screens/Proof";
import type { ActionProof, Series, Token } from "./types";

const tabs = ["Seller", "Investor", "Customer", "Holder", "Proof"] as const;
const liveSeriesId = "first100-live-001";
type Tab = typeof tabs[number];

interface AuditTotals {
  total_liabilities: string;
  solvent: boolean;
}

function readProofs(): ActionProof[] {
  try {
    const value = JSON.parse(localStorage.getItem("first100:proofs") ?? "[]") as unknown;
    return Array.isArray(value) ? value as ActionProof[] : [];
  } catch {
    return [];
  }
}

function shortAccount(value: string | undefined) {
  if (!value) return "Connect wallet";
  return value.length > 25 ? `${value.slice(0, 11)}…${value.slice(-10)}` : value;
}

export default function ProductApp() {
  const [tab, setTab] = useState<Tab>("Investor");
  const [accountId, setAccountId] = useState<string>();
  const [wallet, setWallet] = useState<Wallet>();
  const [proofs, setProofs] = useState<ActionProof[]>(readProofs);
  const [series, setSeries] = useState<Series>();
  const [owner, setOwner] = useState("Loading finalized state…");
  const [audit, setAudit] = useState<AuditTotals>();

  useEffect(() => {
    let subscription: { unsubscribe(): void } | undefined;
    void getWalletKit().then(({ selector }) => {
      const sync = async (state: ReturnType<typeof selector.store.getState>) => {
        const account = state.accounts.find((item) => item.active) ?? state.accounts[0];
        setAccountId(account?.accountId);
        setWallet(account ? await selector.wallet() : undefined);
      };
      void sync(selector.store.getState());
      subscription = selector.store.observable.subscribe((state) => void sync(state));
    });
    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const loadedSeries = await rpc.view<Series | null>("get_series", { series_id: liveSeriesId });
        setSeries(loadedSeries ?? undefined);
        const [token, totals] = await Promise.all([
          loadedSeries
            ? rpc.view<Token | null>("nft_token", { token_id: loadedSeries.beneficiary_token_id })
            : Promise.resolve(null),
          rpc.view<AuditTotals>("audit_totals", {}),
        ]);
        setOwner(token?.owner_id ?? "Not minted");
        setAudit(totals);
      } catch {
        setOwner("RPC unavailable");
      }
    })();
  }, []);

  function record(proof: ActionProof) {
    setProofs((current) => {
      const next = [...current.filter((item) => item.hash !== proof.hash), proof];
      localStorage.setItem("first100:proofs", JSON.stringify(next));
      return next;
    });
  }

  async function connect() {
    (await getWalletKit()).modal.show();
  }

  async function signOut() {
    const kit = await getWalletKit();
    await (await kit.selector.wallet()).signOut();
  }

  return <div className="product-app">
    <header className="product-header">
      <a className="product-brand" href="/" aria-label="FIRST100 home">
        <span><img src={logo} alt="" /></span>FIRST100
      </a>
      <div className="product-network"><i /> {networkId.toUpperCase()} · LIVE CONTRACT</div>
      <a className="product-explorer" href={`${explorerBase}/address/${contractId}`} target="_blank" rel="noreferrer">Explorer ↗</a>
      <button className="wallet-button" onClick={() => void (accountId ? signOut() : connect())}>{shortAccount(accountId)}</button>
    </header>

    <main className="product-main">
      <section className="product-intro">
        <div>
          <div className="product-kicker">ONCHAIN REVENUE FINANCING · NEAR</div>
          <h1>Operate the<br /><em>revenue right.</em></h1>
        </div>
        <p>List, fund, use, transfer, and verify a bounded stream of buyer-confirmed AI service revenue. Every financial action resolves to finalized contract state.</p>
      </section>

      <section className="live-rail" aria-label="Live protocol state">
        <div><span>LIVE SERIES</span><strong>{series?.id ?? liveSeriesId}</strong></div>
        <div><span>SETTLED RIGHT</span><strong>{series ? `${series.settled_count} / ${series.cap_n}` : "— / —"}</strong></div>
        <div><span>CURRENT HOLDER</span><strong title={owner}>{shortAccount(owner)}</strong></div>
        <div><span>ACCOUNTING</span><strong className={audit?.solvent ? "positive" : ""}>{audit ? (audit.solvent ? "SOLVENT" : "CHECK") : "LOADING"}</strong></div>
      </section>

      <nav className="product-tabs" aria-label="FIRST100 workflows">
        {tabs.map((item, index) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
          <span>0{index + 1}</span>{item}
        </button>)}
      </nav>

      <div className="deployment-strip">
        <span>CONTRACT</span><code>{contractId}</code><span className="configured">FINALIZED RPC</span>
      </div>

      {tab === "Seller" && <Seller wallet={wallet} accountId={accountId} record={record} />}
      {tab === "Investor" && <Investor wallet={wallet} record={record} />}
      {tab === "Customer" && <Customer wallet={wallet} accountId={accountId} record={record} />}
      {tab === "Holder" && <Holder wallet={wallet} accountId={accountId} record={record} />}
      {tab === "Proof" && <Proof sessionProofs={proofs} />}
    </main>

    <footer className="product-footer">
      <span>FIRST100 · VERIFIABLE REVENUE RIGHTS</span>
      <span>TESTNET · RETURNS ARE NOT GUARANTEED · VERIFY EVERY TRANSACTION</span>
    </footer>
  </div>;
}
