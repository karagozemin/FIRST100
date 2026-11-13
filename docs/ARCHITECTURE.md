# Architecture and trust boundaries

## Source layout

- `contracts/revenue-rights`: onchain state machine and NEP-171 revenue right.
- `gateway`: verifies payment and wallet proof, executes the service, and commits the response hash onchain.
- `sdk`: UI-independent hashing, RPC, and ledger verification tools.
- `app`: React client for five protocol roles.
- `tests/workspaces`: integration suite that executes the compiled WASM on a current NEAR sandbox.
- `evidence`: reserved exclusively for reproducible testnet transaction evidence.

## State machines

Series: `LISTED -> FUNDED -> CLOSED`; an unfunded series can become `CANCELLED`. A service identifier can have at most one active funded series at a time.

Order: `PAID_PENDING -> DELIVERED -> SETTLED`. A `PAID_PENDING` or `DELIVERED` order that remains unresolved after its deadline can become `REFUNDED` through a buyer call. A terminal state cannot be processed again.

Withdrawal: `IN_FLIGHT -> COMPLETED | RESTORED`. The callback can only originate from the contract itself, and a terminal result cannot be applied twice.

## Settlement timing

The beneficiary is not fixed when an order is created. The contract reads `owner_by_id` in the block that processes the customer's `confirm_delivery` call. Previously accrued credit therefore stays with the original account, while later confirmed revenue routes to the new owner. While an `nft_transfer_call` resolver is pending, `pending_transfers` blocks settlement for that token. The resolver then accepts or reverts the transfer before releasing the lock.

## Offchain verification

The gateway is not the accounting authority. It reads contract and order state from finalized RPC, verifies that the NEP-413 signature belongs to an active full-access key, confirms that the payment transaction contains the expected signer and order result, and checks that the request body matches the onchain commitment. Output quality remains subject to customer confirmation.
