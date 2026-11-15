# Service agent

The service agent is implemented in `gateway/`. It uses finalized NEAR RPC to return the requested account's balance, locked balance, storage usage, code hash, and account or contract classification. The result is hashed as deterministic canonical JSON, and the gateway account submits that hash to the contract.

This directory makes the PRD agent boundary explicit without introducing a second runtime or duplicate implementation.
