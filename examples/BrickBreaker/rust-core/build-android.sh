#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$HOME/.cargo/bin:$PATH"

if ! command -v cargo-ndk &> /dev/null; then
    echo "cargo-ndk not found in PATH. Install with: cargo install cargo-ndk"
    exit 1
fi

echo "==> Building Rust static libraries for Android ABIs..."
cargo ndk -t arm64-v8a -t x86_64 -t armeabi-v7a -t x86 build --release

echo "==> Successfully compiled Android librust_core.a targets in rust-core/target/"

