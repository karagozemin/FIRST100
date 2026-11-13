# 90-second judge demo

## Prerequisite

Run this demo only after a real testnet deployment and a successful verification of `evidence/testnet-transactions.json`. Open explorer tabs in advance. Never simulate transaction hashes or balances.

## Walkthrough

**0-12 seconds:** "We finance the first 100 paid calls of an AI service without selling the company or its later revenue." Show the service, series, and cap on the seller screen.

**12-25 seconds:** The investor sends the advance. Open the `series_funded` and NEP-171 `nft_mint` events in the explorer.

**25-45 seconds:** The customer pays to commit a real NEAR account research request onchain, authorizes the gateway with NEP-413, receives finalized RPC output, and verifies the response hash match.

**45-58 seconds:** The customer confirms delivery. Show the revenue credit for holder A and the audit totals.

**58-72 seconds:** A transfers the NFT to B. A's prior credit remains unchanged. A second confirmed customer flow credits B.

**72-84 seconds:** Show that a call after the cap routes to the seller and that `settled_count` never exceeds the cap.

**84-90 seconds:** Show real transaction hashes and the independent ledger verifier on the proof screen: "This NFT is not speculation. It is a contract-managed, auditable right to future revenue."
