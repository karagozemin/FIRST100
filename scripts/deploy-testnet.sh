#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${CONTRACT_ID:?Set CONTRACT_ID to a testnet account you control}"
: "${OWNER_ID:?Set OWNER_ID to the protocol owner account}"

if ! command -v near >/dev/null 2>&1; then
  echo "The official NEAR CLI is required for deployment." >&2
  exit 1
fi

cd "$PROJECT_DIR"
bash scripts/build-contract.sh
near contract deploy "$CONTRACT_ID" use-file artifacts/first100_revenue_rights.wasm \
  with-init-call new json-args "{\"owner_id\":\"$OWNER_ID\",\"operating_reserve\":\"200000000000000000000000\"}" \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send

echo "Deployment sent. Record the real transaction hash in evidence/testnet-transactions.json; never use placeholders."
