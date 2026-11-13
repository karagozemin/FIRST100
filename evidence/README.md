# Testnet evidence

This directory is reserved for real, public, and independently reproducible testnet transaction identifiers. The current manifest is marked `not-deployed`; this is the intentional and accurate delivery state.

After deployment, record at least these transactions: deployment and initialization, service registration, series listing, funding and NFT minting, customer payment, delivery commitment, confirmation, NFT transfer, a second confirmation after transfer, and withdrawal. Verify every identifier through an explorer and finalized RPC.

`npm run verify:ledger -- evidence/testnet-transactions.json` rejects placeholders, a missing contract ID, and an undeployed state.
