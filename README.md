# FIRST100

FIRST100 is a NEAR protocol that turns a bounded set of future AI service sales into upfront financing. When an investor funds a series, the investor receives a NEP-171 revenue-right NFT. Each customer sale is paid onchain; the gateway commits the real service output hash; and, after customer confirmation, revenue accrues to the account that owns the NFT at that settlement moment.

This repository implements the P0 core defined in PRD v2.0. It does not claim a testnet deployment or real transaction hashes yet; the evidence manifest is intentionally marked `not-deployed`.

## Implemented scope

- Rust/NEAR contract: service registration, series listing, one-time funding, NFT minting, paid orders, delivery commitments, customer confirmation, timeout refunds, and pull-payment withdrawals.
- Revenue rights: prior accrual remains with the original account; after transfer, the next confirmed sales within the first `N` route to the new NFT owner; sales after `N` return to the seller.
- NEP-171: `nft_transfer`, `nft_transfer_call`, and asynchronous resolution. Settlement is locked while a transfer resolver is pending.
- Accounting: credits, escrow, and in-flight withdrawal totals; checked arithmetic; one-time credit restoration after failed transfers; and an auditable `audit_totals` view.
- Gateway: finalized NEAR RPC, NEP-413 wallet proof, payment transaction verification, request commitment checks, persistent idempotency records, and a real NEAR account research service.
- React application: seller, investor, customer, holder, and proof workflows.
- SDK: canonical JSON hashing, RPC client utilities, and an independent ledger replay verifier.

## Architecture

```text
Seller --register/list--> NEAR contract <--fund/mint-- Investor
                              ^   |                         |
                              |   +-- NEP-171 future right -+
Customer --pay order----------+
   |                          |
   +--NEP-413--> Gateway --delivery hash--> contract
        |            |                         |
        |            +-- finalized RPC data   +--buyer confirm
        +-------- verified output <-------------- revenue credit
```

See [architecture](docs/ARCHITECTURE.md), [invariants](docs/INVARIANTS.md), [threat model](docs/THREAT_MODEL.md), and [known limitations](docs/KNOWN_LIMITATIONS.md).

## Quick start

Requirements: Node.js 22+, npm, Rust 1.95, and the `wasm32-unknown-unknown` target. The build script downloads the official cargo-near 0.23.0 binary into the project cache for the current platform and verifies its version before use.

```bash
npm install
rustup target add wasm32-unknown-unknown --toolchain 1.95.0
cp .env.example .env
npm test
npm run build:contract
npm run test:workspaces
```

`test:workspaces` downloads NEAR sandbox 2.14.0 into the project-local `.cache` directory and verifies its version before execution. Supported development platforms are Apple Silicon macOS and x86_64 Linux.

Run the local gateway and UI:

```bash
npm run dev:gateway
npm run dev:app
```

A real `CONTRACT_ID`, gateway account, and gateway private key must be configured in `.env`. Never commit the private key.

## Tests

```bash
npm run test:contract      # 31 Rust unit and adversarial tests
npm run test -w gateway    # payment, authentication, hash, and idempotency integration tests
npm run test -w sdk        # canonical hashing and ledger replay tests
npm run test:workspaces    # optimized WASM with six sandbox accounts
npm run test:e2e           # Chromium smoke test across all five UI roles
npm run build              # production builds for gateway, UI, and SDK
```

The sandbox suite verifies one continuous protocol flow: the seller registers and lists a series; investor A funds it; customer C pays and confirms; A transfers the NFT to B; customer D pays and confirms; A retains the prior credit while B receives the new credit; a sale after the cap routes to the seller; and total liabilities reconcile.

## Testnet deployment

Set testnet accounts that you control:

```bash
export CONTRACT_ID=first100-yourname.testnet
export OWNER_ID=yourname.testnet
npm run deploy:testnet
```

The deployment script signs through the local NEAR keychain and does not accept a raw private key. After deployment, record only real transaction hashes in `evidence/testnet-transactions.json`, then verify them:

```bash
npm run verify:ledger -- evidence/testnet-transactions.json
```

The verifier rejects placeholders and the `not-deployed` state.

## Contract deposits

| Method | Attached deposit |
| --- | ---: |
| `register_service` | exactly `0.01 NEAR` |
| `create_series` | exactly `0.02 NEAR` |
| `fund_series` | exactly the configured advance |
| `create_order` | exactly the unit price |
| `nft_transfer*` | `1 yoctoNEAR` |
| `withdraw` | `1 yoctoNEAR` |

All financial amounts are transported as decimal yoctoNEAR strings in JSON. Timestamps are also decimal nanosecond strings to prevent JavaScript precision loss.

## Delivery status

- Local production build: complete.
- Contract, gateway, and SDK tests: passing.
- NEAR sandbox end-to-end tests: passing.
- Testnet deployment and real explorer hashes: **not completed**.
- Independent security audit: **not completed**.

Use [HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md) for the submission draft and [the demo script](docs/DEMO_SCRIPT.md) for the 90-second walkthrough.

## License

MIT. See [LICENSE](LICENSE).
