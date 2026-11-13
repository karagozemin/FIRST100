# Threat model

## Protected assets

- Funding advances, customer escrow, and account credits.
- The transferable right to the first `N` confirmed sales.
- The binding between an order request, service response, and onchain commitments.
- Protection against processing the same sale or nonce more than once.

## Defenses

- Authorization: service and series actions belong to the operator; delivery belongs to the gateway or operator; confirmation and refund belong to the buyer; transfer belongs to the NFT owner.
- Replay protection: each buyer, series, and client nonce tuple is single-use. Gateway wallet challenges are short-lived and single-use.
- Pricing: exact-deposit checks reject underpayment and overpayment.
- Double settlement or refund: terminal order states and checked arithmetic prevent repeated processing.
- Transfer races: a token-level settlement lock remains active during asynchronous NEP-171 resolution.
- Withdrawal races: credit is reduced before the in-flight record is created; the callback either completes the transfer or restores credit once.
- Gateway verification: finalized RPC, active access-key verification, NEP-413, payment transaction verification, and request commitment checks.
- Evidence integrity: the ledger verifier rejects placeholders and undeployed manifests.

## Trusted components

- NEAR consensus and the selected finalized RPC providers.
- The gateway account private key and gateway host security.
- The customer's honest evaluation of the received output.
- The seller's commitment not to divert the same service revenue outside FIRST100.

A compromised gateway can commit an incorrect response hash, but it cannot settle revenue without customer confirmation. A malicious customer can refuse to confirm valid output and recover funds after the timeout. P0 does not include arbitration.
