import logo from "../../first100-logo.png";
import ProductApp from "./ProductApp";

const githubUrl = "https://github.com/karagozemin/FIRST100";
const architectureUrl = `${githubUrl}/blob/main/docs/ARCHITECTURE.md`;
const contractUrl = "https://explorer.testnet.near.org/accounts/first100-v2-20261115.testnet";

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function Brand() {
  return <a className="brand" href="#top" aria-label="FIRST100 home">
    <span className="brand-mark"><img src={logo} alt="" /></span>
    <span>FIRST100</span>
  </a>;
}

export default function App() {
  if (window.location.pathname.replace(/\/$/, "") === "/app") return <ProductApp />;

  return <div id="top" className="site-shell">
    <header className="site-header">
      <Brand />
      <nav aria-label="Primary navigation">
        <a href="#protocol">Protocol</a>
        <a href="#proof">Proof</a>
        <a href="/app">App</a>
      </nav>
      <a className="header-link" href={githubUrl} target="_blank" rel="noreferrer">GitHub <Arrow /></a>
    </header>

    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="signal-line"><span /> Revenue financing for paid AI services</div>
          <h1 id="hero-title">Finance the first <em>100</em> sales.<br />Keep everything after.</h1>
          <p className="hero-lede">FIRST100 turns a bounded stream of buyer-confirmed API revenue into a transferable onchain right—without selling the company, the service, or the rest of its future.</p>
          <div className="hero-actions">
            <a className="button button-dark" href="/app">Launch app <Arrow /></a>
            <a className="text-link" href={architectureUrl} target="_blank" rel="noreferrer">Read the architecture <Arrow /></a>
          </div>
        </div>

        <div className="term-sheet" aria-label="Illustrative FIRST100 series terms">
          <div className="term-topline"><span>REVENUE SERIES</span><strong>01 / 100</strong></div>
          <div className="term-title">Agent Research<br />API</div>
          <dl>
            <div><dt>Right</dt><dd>First 100 confirmed sales</dd></div>
            <div><dt>Ownership</dt><dd>NEP-171 transferable NFT</dd></div>
            <div><dt>Settlement</dt><dd>Current holder at confirmation</dd></div>
            <div><dt>After cap</dt><dd>Revenue returns to seller</dd></div>
          </dl>
          <div className="term-footer"><span>ILLUSTRATIVE TERMS</span><span>NOT AN ACTIVE OFFER</span></div>
        </div>
      </section>

      <div className="principle-strip" aria-label="Protocol principles">
        <span>BOUNDED RIGHTS</span><i />
        <span>VERIFIED PAYMENT</span><i />
        <span>BUYER CONFIRMATION</span><i />
        <span>TRANSFERABLE OWNERSHIP</span>
      </div>

      <section id="protocol" className="protocol-section section-pad">
        <div className="section-intro">
          <p className="section-index">01 — THE PROTOCOL</p>
          <h2>A financing primitive with a clear edge.</h2>
          <p>Not equity. Not a loan. Not a claim on every future dollar. FIRST100 isolates one finite entitlement and lets the contract enforce where each confirmed sale goes.</p>
        </div>

        <div className="steps">
          <article>
            <span className="step-number">01</span>
            <div><h3>Set the boundary</h3><p>The seller defines the exact advance, unit price, expiration, and number of eligible sales.</p></div>
          </article>
          <article>
            <span className="step-number">02</span>
            <div><h3>Fund the series</h3><p>One investor sends the exact advance. The seller receives credit and the investor receives the revenue-right NFT.</p></div>
          </article>
          <article>
            <span className="step-number">03</span>
            <div><h3>Earn on confirmation</h3><p>Customers pay onchain, receive the service output, and confirm delivery before revenue can settle.</p></div>
          </article>
          <article>
            <span className="step-number">04</span>
            <div><h3>Transfer only the future</h3><p>The NFT routes later settlements to its new owner. Prior credit never moves with it.</p></div>
          </article>
        </div>
      </section>

      <section className="boundary-section">
        <div className="boundary-copy">
          <p className="section-index">02 — THE BOUNDARY</p>
          <h2>One asset.<br />Nothing hidden inside it.</h2>
          <p>The contract makes the entitlement legible: who funded it, who owns it now, how many eligible settlements remain, and what happens when the cap is reached.</p>
          <a className="text-link light" href={architectureUrl} target="_blank" rel="noreferrer">Inspect the protocol design <Arrow /></a>
        </div>
        <div className="boundary-ledger">
          <div className="ledger-head"><span>RIGHT: FIRST-100</span><span>ONCHAIN</span></div>
          <div className="ledger-row"><span>Company equity</span><strong>NOT INCLUDED</strong></div>
          <div className="ledger-row"><span>Service ownership</span><strong>NOT INCLUDED</strong></div>
          <div className="ledger-row"><span>Prior accrual</span><strong>STAYS PUT</strong></div>
          <div className="ledger-row active"><span>Future confirmed sales</span><strong>FOLLOWS NFT</strong></div>
          <div className="ledger-row"><span>Revenue after cap</span><strong>RETURNS TO SELLER</strong></div>
          <div className="ledger-total"><span>Entitlement</span><strong>FINITE</strong></div>
        </div>
      </section>

      <section id="proof" className="proof-section section-pad">
        <div className="proof-heading">
          <p className="section-index">03 — PROOF, NOT PROMISES</p>
          <h2>Built to be checked.</h2>
          <p>The interface is not the source of truth. Every material claim resolves to contract state, structured events, or a finalized transaction.</p>
        </div>
        <div className="proof-grid">
          <article><span>01</span><h3>Finalized payment</h3><p>The gateway verifies signer, receiver, method, and returned order ID before execution.</p></article>
          <article><span>02</span><h3>Committed output</h3><p>Canonical request and response hashes bind payment, execution, and buyer confirmation.</p></article>
          <article><span>03</span><h3>Replayable ledger</h3><p>Independent tooling rebuilds terminal events and reconciles them with onchain audit totals.</p></article>
        </div>
        <div className="proof-bar">
          <div><span className="proof-dot" /> LIVE TESTNET EVIDENCE</div>
          <div><strong>55</strong><span>automated tests</span></div>
          <div><strong>6</strong><span>sandbox accounts</span></div>
          <div><strong>0</strong><span>fabricated testnet claims</span></div>
          <a href={contractUrl} target="_blank" rel="noreferrer">Open contract <Arrow /></a>
        </div>
      </section>

      <section id="app" className="app-preview section-pad">
        <div className="app-copy">
          <p className="section-index">04 — THE APP</p>
          <div className="coming-pill"><span /> LIVE ON TESTNET</div>
          <h2>Use the protocol, end to end.</h2>
          <p>Connect a NEAR testnet wallet to list a service, fund a revenue series, purchase a paid API call, transfer the revenue right, withdraw credit, and inspect finalized proof.</p>
          <a className="button button-dark app-launch" href="/app">Open the app <Arrow /></a>
        </div>
        <div className="dashboard-shell dashboard-live" aria-label="FIRST100 application overview">
          <div className="dashboard-top"><Brand /><span>TESTNET / LIVE</span></div>
          <div className="dashboard-tabs"><span>SELLER</span><span>INVESTOR</span><span>CUSTOMER</span><span>HOLDER</span><span>PROOF</span></div>
          <div className="dashboard-body">
            <div className="preview-main">
              <span className="preview-label">FIRST100-LIVE-001</span>
              <div className="dashboard-value">2 / 100</div>
              <div className="dashboard-caption">CONFIRMED REVENUE RIGHT</div>
              <div className="preview-chart"><i /><i /><i /><i /><i /><i /><i /><i /></div>
            </div>
            <div className="preview-side">
              <span className="preview-label">SETTLEMENT</span>
              <div className="preview-stat">2<small>CONFIRMED SALES</small></div>
              <div className="preview-stat live-state">SOLVENT<small>ONCHAIN ACCOUNTING</small></div>
            </div>
          </div>
          <a className="dashboard-open" href="/app">OPEN APPLICATION <Arrow /></a>
        </div>
      </section>

      <section className="closing-section">
        <div><p className="section-index">OPEN PROTOCOL / LIVE TESTNET</p><h2>Fund the work.<br />Keep the future.</h2></div>
        <div className="closing-actions">
          <a className="button button-violet" href="/app">Launch app <Arrow /></a>
          <a className="text-link" href={architectureUrl} target="_blank" rel="noreferrer">Architecture <Arrow /></a>
        </div>
      </section>
    </main>

    <footer className="site-footer">
      <Brand />
      <p>Verifiable revenue rights for paid AI services.</p>
      <div><span>NEAR / TESTNET</span><span>© 2026 FIRST100</span></div>
    </footer>
  </div>;
}
