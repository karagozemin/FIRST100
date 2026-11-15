# FIRST100 — Submission draft

> Status: Contract, gateway, SDK, sandbox, public landing, and public testnet evidence are complete. The interactive wallet dashboard remains intentionally unavailable.

## One-liner

FIRST100 turns the first N verified sales of an AI service into a transferable NEP-171 revenue right, without selling the company or its later revenue.

## Problem

Early AI services need runway before recurring revenue is established. Loans require credit, equity sells the whole upside, and speculative NFTs do not prove customer payment or service delivery.

## Solution

A seller lists a bounded series with an advance, price and cap. One investor funds it and receives the revenue-right NFT. Customers pay per request on NEAR; an authenticated gateway verifies the transaction, executes a real service and commits the output hash. The customer confirms the output. Until the cap is reached, the contract credits whoever owns the NFT at confirmation time. Prior accruals never move with the NFT.

## Why the NFT does something

The token is the live routing key for future, buyer-confirmed protocol revenue. Transfer changes the beneficiary of later settlements while preserving all historical accounting. `nft_transfer_call` is protected against asynchronous resolver races.

## Verifiable proof

- 31 contract unit/adversarial tests.
- 8 gateway integration tests and 6 independent SDK/ledger tests.
- Five-flow sandbox suite using deployed optimized WASM and six accounts.
- Chromium smoke coverage for the public landing and honest `COMING SOON` dashboard state.
- Onchain audit totals and NEP event logs.
- Nineteen finalized testnet transactions, two real service receipts, a timeout refund, and three completed withdrawals.
- Reproducible build/test commands in the README.

## Honest limitations

FIRST100 cannot prevent a seller from routing economic activity outside the protocol, and settlement depends on customer confirmation. The P0 gateway is single-instance and has not received an independent security audit. These are disclosed product boundaries, not hidden assumptions.

## Public links

- Live app: https://first100-liard.vercel.app
- Contract: https://explorer.testnet.near.org/accounts/first100-v2-20261115.testnet
- First settlement: https://explorer.testnet.near.org/transactions/2T7cBtrycCjcNxQzVDkJVxFEoCa9Rb2wAxvqESvqt8Ek
- Post-transfer settlement: https://explorer.testnet.near.org/transactions/78ZKVU5irTEUDW9BrEKfkCB74a1dbaD3QHFbtsRcPWdN
- Timeout refund: https://explorer.testnet.near.org/transactions/6grwuYPbzXh66FVXEV9uQcuBqMkGw7WKkLp51yHogYvD
- 90-second video: `TBD — do not submit a placeholder`
