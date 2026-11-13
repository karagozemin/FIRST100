# FIRST100 — Submission draft

> Status: Local P0 and sandbox evidence are complete. Keep testnet URL and hash fields empty until a real deployment exists.

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
- 7 gateway integration tests and 6 independent SDK/ledger tests.
- Five-state sandbox suite using deployed optimized WASM and six accounts.
- Chromium smoke coverage for all five product roles and honest deployment state.
- Onchain audit totals and NEP event logs.
- Reproducible build/test commands in the README.

## Honest limitations

FIRST100 cannot prevent a seller from routing economic activity outside the protocol, and settlement depends on customer confirmation. The P0 gateway is single-instance and has not received an independent security audit. These are disclosed product boundaries, not hidden assumptions.

## Links to fill after deploy

- Live app: `TBD — do not submit a placeholder`
- Contract: `TBD — do not submit a placeholder`
- Explorer proof: `TBD — do not submit a placeholder`
- 90-second video: `TBD — do not submit a placeholder`
