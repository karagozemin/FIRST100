import { useEffect, useState } from "react";
import type { Wallet } from "@near-wallet-selector/core";
import { contractId, getWalletKit } from "./near";
import { Seller } from "./screens/Seller";
import { Investor } from "./screens/Investor";
import { Customer } from "./screens/Customer";
import { Holder } from "./screens/Holder";
import { Proof } from "./screens/Proof";
import type { ActionProof } from "./types";

const tabs = ["Seller", "Investor", "Customer", "Holder", "Proof"] as const;
type Tab = typeof tabs[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("Seller");
  const [accountId, setAccountId] = useState<string>();
  const [wallet, setWallet] = useState<Wallet>();
  const [proofs, setProofs] = useState<ActionProof[]>(() => JSON.parse(localStorage.getItem("first100:proofs") ?? "[]") as ActionProof[]);

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

  function record(proof: ActionProof) {
    setProofs((current) => {
      const next = [...current.filter((item) => item.hash !== proof.hash), proof];
      localStorage.setItem("first100:proofs", JSON.stringify(next));
      return next;
    });
  }
  async function connect() { (await getWalletKit()).modal.show(); }
  async function signOut() {
    const kit = await getWalletKit();
    const activeWallet = await kit.selector.wallet();
    await activeWallet.signOut();
  }

  return <div className="app-shell">
    <header>
      <a className="brand" href="#"><span>F</span> FIRST100</a>
      <div className="network"><i /> NEAR TESTNET</div>
      <button className="wallet-button" onClick={() => void (accountId ? signOut() : connect())}>{accountId ?? "Connect wallet"}</button>
    </header>
    <main>
      <section className="hero">
        <div><div className="kicker">VERIFIABLE REVENUE RIGHTS FOR AUTONOMOUS APIs</div><h1>Sell your next <em>100</em> verified API sales.</h1></div>
        <p>Fund your agent today. Keep the business. Transfer only a bounded stream of future, buyer-confirmed revenue.</p>
      </section>
      <nav className="tabs" aria-label="FIRST100 workflows">
        {tabs.map((item, index) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}><span>0{index + 1}</span>{item}</button>)}
      </nav>
      <div className="deployment-strip"><span>Contract</span><code>{contractId}</code><span className={contractId.includes("replace") ? "unconfigured" : "configured"}>{contractId.includes("replace") ? "UNCONFIGURED" : "LIVE CONFIG"}</span></div>
      {tab === "Seller" && <Seller wallet={wallet} accountId={accountId} record={record} />}
      {tab === "Investor" && <Investor wallet={wallet} record={record} />}
      {tab === "Customer" && <Customer wallet={wallet} accountId={accountId} record={record} />}
      {tab === "Holder" && <Holder wallet={wallet} accountId={accountId} record={record} />}
      {tab === "Proof" && <Proof sessionProofs={proofs} />}
    </main>
    <footer><span>FIRST100 · protocol prototype</span><span>No guaranteed return · Testnet only · Audit required before production</span></footer>
  </div>;
}
