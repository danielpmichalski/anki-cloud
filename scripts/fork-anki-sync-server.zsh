#!/usr/bin/env zsh
# Usage:
#   ./scripts/fork-anki-sync-server.zsh           # forks/upgrades to default tag (25.09)
#   ./scripts/fork-anki-sync-server.zsh 25.12     # forks/upgrades to a specific tag
#
# Copies rslib/ and Cargo.lock from ankitects/anki at the given tag into
# anki-sync-server/. Safe to re-run for upgrades — only rslib/ and Cargo.lock
# are replaced; Cargo.toml and README.md in anki-sync-server/ are left untouched.
set -euo pipefail

ANKI_TAG=${1:-25.09}
REPO_ROOT=$(git rev-parse --show-toplevel)
TARGET_DIR="$REPO_ROOT/anki-sync-server"
TMP_DIR=$(mktemp -d)

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "==> Cloning ankitects/anki@$ANKI_TAG ..."
git clone --depth=1 --branch "$ANKI_TAG" \
  https://github.com/ankitects/anki.git "$TMP_DIR/anki"

echo "==> Replacing anki-sync-server/rslib/ ..."
rm -rf "$TARGET_DIR/rslib"
cp -r "$TMP_DIR/anki/rslib" "$TARGET_DIR/rslib"

echo "==> Replacing anki-sync-server/Cargo.lock ..."
cp "$TMP_DIR/anki/Cargo.lock" "$TARGET_DIR/Cargo.lock"

echo ""
echo "Done. ankitects/anki@$ANKI_TAG rslib/ is now at anki-sync-server/rslib/"
echo ""
echo "Next steps:"
echo "  cd anki-sync-server"
echo "  cargo build --bin anki-sync-server"
