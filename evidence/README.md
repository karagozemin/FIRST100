# Testnet evidence

The public contract is deployed at [`first100-v2-20261115.testnet`](https://explorer.testnet.near.org/accounts/first100-v2-20261115.testnet). The manifest contains only real finalized transactions sent to that contract.

The recorded sequence covers deployment and initialization, service registration, series listing, funding and NFT minting, two delivered service orders, buyer confirmations on both sides of an NFT transfer, seller withdrawal, prior-holder withdrawal, and a separate timeout refund followed by customer withdrawal. [`service-receipts.json`](service-receipts.json) binds the two real finalized-RPC service outputs to their request, response, payment, delivery, and confirmation hashes and records the refund proof.

Run the independent verifier:

```bash
npm run verify:ledger -- evidence/testnet-transactions.json
```

The verifier rejects placeholders, failed transactions, the wrong receiver, duplicate terminal outcomes, cap violations, and any event replay that does not reconcile with the contract's finalized `audit_totals` view.
