#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

echo "==> [1/4] Compiling Rust for iOS Device (aarch64-apple-ios)..."
cargo build --target aarch64-apple-ios --release

echo "==> [2/4] Compiling Rust for iOS Simulator (arm64 + x86_64)..."
cargo build --target aarch64-apple-ios-sim --release
cargo build --target x86_64-apple-ios --release

echo "==> [3/4] Creating universal simulator archive via lipo..."
mkdir -p target/universal-sim/release
lipo -create \
  target/aarch64-apple-ios-sim/release/librust_core.a \
  target/x86_64-apple-ios/release/librust_core.a \
  -output target/universal-sim/release/librust_core.a

echo "==> [4/4] Packaging target/RustCore.xcframework..."
rm -rf target/RustCore.xcframework
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/librust_core.a \
  -headers include \
  -library target/universal-sim/release/librust_core.a \
  -headers include \
  -output target/RustCore.xcframework

echo "==> Successfully generated rust-core/target/RustCore.xcframework"

