# Accounting and protocol invariants

1. A series can be funded once, only while `LISTED`, and only with the exact advance.
2. A service can have at most one active funded series at a time.
3. A buyer, series, and client nonce combination creates at most one order.
4. An order deposit must exactly equal the unit price; underpayment and overpayment are rejected.
5. Every order can reach at most one terminal outcome: settlement or refund.
6. `settled_count` increases only for confirmed sales routed to the NFT holder and never exceeds `cap_n`.
7. Revenue after the cap routes to the seller rather than the NFT holder.
8. NFT transfer does not move existing account credits; it changes only the beneficiary of future settlements.
9. Settlement cannot occur for a token while an asynchronous resolver transfer is pending.
10. `total_liabilities = total_credits + active_order_escrow + in_flight_withdrawals`.
11. A failed withdrawal callback restores the amount to credit exactly once; a successful callback creates no credit.
12. The solvency view compares liabilities against the contract balance after storage cost and operating reserve.

Rust adversarial tests and the workspaces flow exercise these rules wherever the state can be reproduced locally. `audit_totals` lets an external reviewer independently recompute aggregate liabilities; it does not guarantee economic performance or external service quality.
