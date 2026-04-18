#!/usr/bin/env zsh
# One-time dev environment setup for macOS.
# Safe to re-run — skips anything already installed.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo "${GREEN}  ✓${RESET} $*"; }
info() { echo "${YELLOW}  →${RESET} $*"; }
fail() { echo "${RED}  ✗ $*${RESET}"; exit 1; }
header() { echo "\n${BOLD}$*${RESET}"; }

# ── Homebrew ──────────────────────────────────────────────────────────────────
header "Homebrew"
if command -v brew &>/dev/null; then
  ok "brew $(brew --version | head -1 | awk '{print $2}')"
else
  info "Installing Homebrew ..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for the rest of this script (Apple Silicon path)
  [[ -f /opt/homebrew/bin/brew ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
  ok "Homebrew installed"
fi

# ── Rust + Cargo (via rustup) ─────────────────────────────────────────────────
header "Rust (rustup)"
if command -v rustup &>/dev/null; then
  ok "rustup $(rustup --version 2>&1 | head -1)"
  info "Updating toolchain ..."
  rustup update stable --no-self-update
  ok "Rust $(rustc --version)"
else
  info "Installing Rust via rustup ..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  source "$HOME/.cargo/env"
  ok "Rust $(rustc --version)"
fi

# Ensure cargo is on PATH for the rest of the script
[[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"

# Enforce minimum version (1.80 per rust-version in Cargo.toml)
RUST_VERSION=$(rustc --version | awk '{print $2}')
REQUIRED="1.80"
if [[ "$(printf '%s\n' "$REQUIRED" "$RUST_VERSION" | sort -V | head -1)" != "$REQUIRED" ]]; then
  fail "Rust $RUST_VERSION is below the required $REQUIRED. Run: rustup update stable"
fi
ok "Rust version $RUST_VERSION (>= $REQUIRED required)"

# ── protoc (Protocol Buffers compiler) ────────────────────────────────────────
header "protoc"
if command -v protoc &>/dev/null; then
  ok "$(protoc --version)"
else
  info "Installing protobuf via brew ..."
  brew install protobuf
  ok "$(protoc --version)"
fi

# ── Bun (TypeScript runtime for api/, mcp/, web/) ────────────────────────────
header "Bun"
if command -v bun &>/dev/null; then
  ok "bun $(bun --version)"
else
  info "Installing Bun ..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  ok "bun $(bun --version)"
fi

# ── Docker ────────────────────────────────────────────────────────────────────
header "Docker"
if command -v docker &>/dev/null; then
  ok "$(docker --version)"
else
  info "Docker not found. Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
  info "(Skipping — required for 'docker compose up' but not for local Rust/TS dev)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}All done! Your shell may need reloading for PATH changes to take effect:${RESET}"
echo "  source ~/.zshrc"
echo ""
echo "Next:"
echo "  cd anki-sync-server && cargo build --bin anki-sync-server"
