#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX_VERSION="2.14.0"
CACHE_DIR="$PROJECT_DIR/.cache/near-sandbox-$SANDBOX_VERSION"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) ARTIFACT_PLATFORM="Darwin-arm64" ;;
  Linux-x86_64) ARTIFACT_PLATFORM="Linux-x86_64" ;;
  *) echo "Unsupported sandbox platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

BINARY_DIR="$CACHE_DIR/$ARTIFACT_PLATFORM"
BINARY="$BINARY_DIR/near-sandbox"

if [[ ! -x "$BINARY" ]]; then
  mkdir -p "$CACHE_DIR"
  ARCHIVE="$CACHE_DIR/near-sandbox.tar.gz"
  URL="https://s3-us-west-1.amazonaws.com/build.nearprotocol.com/nearcore/$ARTIFACT_PLATFORM/$SANDBOX_VERSION/near-sandbox.tar.gz"
  curl --fail --location --silent --show-error "$URL" --output "$ARCHIVE"
  tar -xzf "$ARCHIVE" -C "$CACHE_DIR"
  rm "$ARCHIVE"
  chmod 755 "$BINARY"
fi

VERSION_OUTPUT="$($BINARY --version)"
if [[ "$VERSION_OUTPUT" != *"$SANDBOX_VERSION"* ]]; then
  echo "Unexpected NEAR sandbox version: $VERSION_OUTPUT" >&2
  exit 1
fi

cd "$PROJECT_DIR"
NEAR_SANDBOX_BIN_PATH=1 NEAR_SANDBOX_BINARY_PATH="$BINARY_DIR" \
  npm run test -w @first100/workspaces-tests
