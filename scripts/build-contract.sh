#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

CARGO_NEAR_VERSION="0.23.0"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) TARGET="aarch64-apple-darwin" ;;
  Darwin-x86_64) TARGET="x86_64-apple-darwin" ;;
  Linux-x86_64) TARGET="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64|Linux-arm64) TARGET="aarch64-unknown-linux-gnu" ;;
  *) echo "Unsupported cargo-near platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

CACHE_DIR="$PROJECT_DIR/.cache/cargo-near-$CARGO_NEAR_VERSION/$TARGET"
CARGO_NEAR="$CACHE_DIR/cargo-near"
if [[ ! -x "$CARGO_NEAR" ]]; then
  mkdir -p "$CACHE_DIR"
  ARCHIVE="$CACHE_DIR/cargo-near.tar.gz"
  URL="https://github.com/near/cargo-near/releases/download/cargo-near-v$CARGO_NEAR_VERSION/cargo-near-$TARGET.tar.gz"
  curl --fail --location --silent --show-error "$URL" --output "$ARCHIVE"
  tar -xzf "$ARCHIVE" --strip-components 1 -C "$CACHE_DIR"
  rm "$ARCHIVE"
  chmod 755 "$CARGO_NEAR"
fi

VERSION_OUTPUT="$($CARGO_NEAR near --version)"
if [[ "$VERSION_OUTPUT" != *"$CARGO_NEAR_VERSION"* ]]; then
  echo "Unexpected cargo-near version: $VERSION_OUTPUT" >&2
  exit 1
fi

"$CARGO_NEAR" near build non-reproducible-wasm --no-abi --locked \
  --manifest-path contracts/revenue-rights/Cargo.toml
SOURCE_WASM="target/near/first100_revenue_rights/first100_revenue_rights.wasm"
mkdir -p artifacts
cp "$SOURCE_WASM" artifacts/first100_revenue_rights.wasm
(cd artifacts && shasum -a 256 first100_revenue_rights.wasm | tee first100_revenue_rights.wasm.sha256)
