# React Native + Rust Integration — Complete iOS Guide

This guide shows how to expose Rust functions to a bare React Native iOS app through a Rust static library / XCFramework, C++17, JSI, and a C++ TurboModule.

It uses generic examples (`add`, `multiply`, `greeting`, and a small numeric data store). It contains the actual `.h`, `.cpp`, and `.mm` files, the iOS build and CocoaPods configuration steps, Rust target triples, `RustCore.xcframework` packaging, and the documented Objective-C++ `ModuleProvider` registration.

> **Version note:** The TurboModule/Codegen bootstrap in this guide is strictly scoped to **React Native 0.79.x** (using the documented RN 0.79 `codegenConfig.ios.modulesProvider` configuration and an Objective-C++ `ModuleProvider`). This directly mirrors the React Native 0.79 Android companion guide.
>
> Native registration files and Codegen configurations can vary across React Native versions. Depending on the release and documentation page (e.g., the versioned Pure C++ Modules guide versus the standalone Codegen guide), official React Native documentation references two iOS Codegen schema variants:
> - **Flat structure:** `"ios": { "modulesProvider": { "NativeRustModule": "RustModuleProvider" } }` (used in this RN 0.79.x guide).
> - **Nested structure:** `"ios": { "modules": { "NativeRustModule": { "className": "RustModuleProvider" } } }`.
>
> When targeting or upgrading to other React Native releases, keep the identical Rust C ABI, XCFramework build, and C++ generic binder patterns shown here, but check your target release's specific Codegen documentation and generated artifacts to verify which schema structure your installed version of `@react-native/codegen` expects.

---

## 1. What you will build

JavaScript will call:

```ts
RustModule.add(20, 22);              // 42
RustModule.multiply(6, 7);           // 42
RustModule.isPositive(5);            // true
RustModule.greeting("Alex");         // "Hello, Alex!"
RustModule.setValue(0, 12.5);
RustModule.getValues();              // Float32Array copied from Rust-owned data
```

The call path is:

```text
TypeScript / JavaScript
       |
       | NativeRustModule.install()
       v
C++ TurboModule method receives a valid JSI Runtime
       |
       | installs RustModule HostFunctions
       v
C++ generic JSI binder
       |
       | C ABI call
       v
Rust static library inside RustCore.xcframework
```

The generic binder is the default route for supported function types. Adding another compatible Rust function requires one line:

```cpp
bind(runtime, api, "subtract", rust_subtract);
```

Some operations—such as returning a Rust-owned string or copying a buffer—need an explicit ownership policy. Those policies are implemented once in the generic binder or in the relevant data API; they do not require writing a separate wrapper for every ordinary scalar function.

### Components

| Component | Role |
|---|---|
| React Native / TypeScript | App code and typed wrapper |
| Hermes | JavaScript runtime |
| JSI | Allows native C++ HostFunctions to be called directly from JavaScript |
| C++17 | Generic binder and native integration |
| Rust | Implements the native functions and owns Rust-side data |
| C ABI / FFI | Boundary between Rust and C++ |
| Cargo | Builds Rust for iOS device and simulator target triples |
| `cbindgen` | Generates the C header (`rust_core.h`) for Rust exports |
| `xcodebuild -create-xcframework` | Packages device and simulator archives into a unified `RustCore.xcframework` |
| CocoaPods / Xcode | Compiles C++, vendors the XCFramework, and configures the iOS app |
| Codegen | Generates C++ TurboModule spec interfaces from TypeScript |
| Objective-C++ `ModuleProvider` | Associates the C++ TurboModule with React Native's iOS runtime |

---

## 2. Prerequisites

You need:

- A working **bare React Native** iOS project (**React Native 0.79.x**, New Architecture enabled).
- Node.js (>= 18 / 20 / 22) and your project's package manager (`yarn`, `npm`, or `pnpm`).
- macOS with **Xcode** (15+ or 16+) and Command Line Tools installed (`xcode-select --install`).
- **CocoaPods** installed (`pod --version`).
- **Rust** installed via `rustup` (`rustc --version`, `cargo --version`).
- An iOS Simulator (arm64 Apple Silicon or x86_64 Intel) or a physical iPhone/iPad.

Verify the tools:

```bash
node --version
pod --version
xcodebuild -version
rustc --version
cargo --version
```

### Install iOS Rust Targets

iOS devices and simulators require different target triples in Rust:

| Environment | Architecture | Rust Target Triple |
|---|---|---|
| Physical iOS devices (iPhone/iPad) | 64-bit ARM | `aarch64-apple-ios` |
| iOS Simulator (Apple Silicon M1/M2/M3/M4) | 64-bit ARM | `aarch64-apple-ios-sim` |
| iOS Simulator (Intel Macs) | 64-bit x86_64 | `x86_64-apple-ios` |

Install all three targets via `rustup`:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
```

> **Critical note on `aarch64-apple-ios` vs `aarch64-apple-ios-sim`:**
> Even though both are `arm64`, they are **not binary compatible**. Physical devices use iOS ABI flags (`LC_VERSION_MIN_IPHONEOS` / `LC_BUILD_VERSION` platform 2), while Apple Silicon simulators use Simulator ABI flags (platform 7). Attempting to link `aarch64-apple-ios` into a simulator build produces the Mach-O linker error: *“building for iOS Simulator, but linking in object file built for iOS”*. Packaging them into an `XCFramework` guarantees Xcode always selects the exact matching binary slice.

---

## 3. Create the folder structure

All paths are relative to the React Native project root:

```text
MyReactNativeApp/
├── ios/
│   ├── Podfile
│   └── GamePrototype/
│       ├── AppDelegate.swift          # Modern RN 0.79.x app delegate
│       ├── SceneDelegate.swift        # Scene delegate
│       ├── RustModuleProvider.h       # iOS TurboModule provider header
│       ├── RustModuleProvider.mm      # iOS TurboModule provider (in Main App target)
│       └── Info.plist
├── rust-core/
│   ├── Cargo.toml
│   ├── cbindgen.toml
│   ├── build.rs
│   ├── build-ios.sh                   # Builds RustCore.xcframework
│   ├── include/                       # Generated: rust_core.h
│   ├── target/
│   │   └── RustCore.xcframework       # Universal iOS device + simulator XCFramework
│   └── src/
│       └── lib.rs
├── shared/
│   ├── NativeRustModule.h             # Pure cross-platform C++ header
│   └── NativeRustModule.cpp           # Pure cross-platform C++ generic JSI binder & Rust FFI
├── specs/
│   └── NativeRustModule.ts            # Codegen TurboModule specification
├── src/
│   └── RustModule.ts                  # TypeScript wrapper & install trigger
├── RustModule.podspec                 # Pod compiling shared/**/*.{h,cpp} & vendoring RustCore.xcframework
├── App.tsx
└── package.json                       # Codegen config with ios.modulesProvider mapping
```

Create the directories from the project root:

```bash
mkdir -p rust-core/src rust-core/include shared specs src
```

---

## 4. Rust library

If starting fresh, create the crate with `cargo new rust-core --lib`.

### 4.1 `rust-core/Cargo.toml`

```toml
[package]
name = "rust-core"
version = "0.1.0"
edition = "2024"
build = "build.rs"

[lib]
name = "rust_core"
crate-type = ["staticlib"]

[build-dependencies]
cbindgen = "0.29"

[profile.dev]
panic = "abort"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = 3
```

- `crate-type = ["staticlib"]` tells Cargo to produce `librust_core.a`.
- `panic = "abort"` prevents Rust panics from attempting to unwind through the C ABI boundary into C++/JSI.

### 4.2 `rust-core/cbindgen.toml`

```toml
language = "C"
cpp_compat = true
include_guard = "RUST_CORE_H"
autogen_warning = "/* Generated by cbindgen. Do not edit manually. */"
```

`cpp_compat = true` wraps exported function declarations in `extern "C" { ... }` so they link cleanly into C++17.

### 4.3 `rust-core/build.rs`

```rust
use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR is not set"),
    );

    // Derive the header filename from Cargo.toml's package name:
    // "rust-core" -> "rust_core.h"
    let package_name = env::var("CARGO_PKG_NAME")
        .expect("CARGO_PKG_NAME is not set")
        .replace('-', "_");

    let output_file = crate_dir
        .join("include")
        .join(format!("{package_name}.h"));

    std::fs::create_dir_all(
        output_file.parent().expect("Header path has no parent directory"),
    )
    .expect("Could not create the include directory");

    let config_path = crate_dir.join("cbindgen.toml");
    let config = cbindgen::Config::from_file(&config_path)
        .unwrap_or_default();

    cbindgen::Builder::new()
        .with_crate(&crate_dir)
        .with_config(config)
        .generate()
        .expect("Unable to generate C bindings")
        .write_to_file(output_file);
}
```

This runs automatically during `cargo build` and writes `rust-core/include/rust_core.h`.

### 4.4 `rust-core/src/lib.rs`

This file provides stateless functions, Rust-allocated C string generation, and an opaque stateful data buffer:

```rust
use std::ffi::{c_char, CStr, CString};
use std::ptr;

// ---------- Stateless examples ----------

#[unsafe(no_mangle)]
pub extern "C" fn rust_add(a: f64, b: f64) -> f64 {
    a + b
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_multiply(a: f64, b: f64) -> f64 {
    a * b
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_is_positive(value: f64) -> bool {
    value > 0.0
}

/// Takes a NUL-terminated UTF-8 C string and returns a newly allocated
/// C string. The caller MUST free the returned pointer using rust_string_free().
///
/// # Safety
/// `name` must be null or point to a valid NUL-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_greeting(name: *const c_char) -> *mut c_char {
    if name.is_null() {
        return ptr::null_mut();
    }

    let name = unsafe { CStr::from_ptr(name) }.to_string_lossy();
    match CString::new(format!("Hello, {name}!")) {
        Ok(value) => value.into_raw(),
        Err(_) => ptr::null_mut(),
    }
}

/// Frees a string returned by rust_greeting().
///
/// # Safety
/// `value` must be null or a pointer originally returned by rust_greeting(),
/// and must not have been freed already.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_string_free(value: *mut c_char) {
    if !value.is_null() {
        drop(unsafe { CString::from_raw(value) });
    }
}

// ---------- Stateful data example ----------

pub struct RustData {
    values: Vec<f32>,
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_data_create(value_count: usize) -> *mut RustData {
    Box::into_raw(Box::new(RustData {
        values: vec![0.0; value_count],
    }))
}

/// Sets a value at index. Returns true on success, false if index is out of bounds.
///
/// # Safety
/// `data` must be null or point to a live RustData instance.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_set(
    data: *mut RustData,
    index: usize,
    value: f32,
) -> bool {
    let Some(data) = (unsafe { data.as_mut() }) else {
        return false;
    };

    let Some(slot) = data.values.get_mut(index) else {
        return false;
    };

    *slot = value;
    true
}

/// Returns a borrowed pointer to the internal f32 slice and writes its length.
/// The returned pointer is valid as long as `data` is alive and unmutated.
///
/// # Safety
/// `data` must point to a live RustData. `out_len` must be writable.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_values(
    data: *const RustData,
    out_len: *mut usize,
) -> *const f32 {
    let Some(data) = (unsafe { data.as_ref() }) else {
        if !out_len.is_null() {
            unsafe { *out_len = 0 };
        }
        return ptr::null();
    };

    if !out_len.is_null() {
        unsafe { *out_len = data.values.len() };
    }

    data.values.as_ptr()
}

/// Destroys a RustData instance.
///
/// # Safety
/// `data` must be null or a pointer returned by rust_data_create(), and must
/// not be used again after destruction.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_destroy(data: *mut RustData) {
    if !data.is_null() {
        drop(unsafe { Box::from_raw(data) });
    }
}
```

### 4.5 Check the crate

```bash
cd rust-core
cargo check
cd ..
```

---

## 5. Build Rust for iOS: The XCFramework Packaging Strategy

To cleanly support both physical iOS devices and simulators (both Apple Silicon M-series and Intel) without architecture conflicts or `$ARCHS` build-script bugs, we package the Rust libraries into an **Apple XCFramework** (`RustCore.xcframework`).

An XCFramework bundles:
1. `ios-arm64`: Built for physical devices (`aarch64-apple-ios`).
2. `ios-arm64_x86_64-simulator`: Universal fat binary combining `aarch64-apple-ios-sim` and `x86_64-apple-ios` via `lipo`.

### 5.1 Manual Steps to Build `RustCore.xcframework`

From `rust-core/`:

```bash
# 1. Build physical device library
cargo build --target aarch64-apple-ios --release

# 2. Build simulator libraries
cargo build --target aarch64-apple-ios-sim --release
cargo build --target x86_64-apple-ios --release

# 3. Create universal simulator static library using lipo
mkdir -p target/universal-sim/release
lipo -create \
  target/aarch64-apple-ios-sim/release/librust_core.a \
  target/x86_64-apple-ios/release/librust_core.a \
  -output target/universal-sim/release/librust_core.a

# 4. Package into RustCore.xcframework
rm -rf target/RustCore.xcframework
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/librust_core.a \
  -headers include \
  -library target/universal-sim/release/librust_core.a \
  -headers include \
  -output target/RustCore.xcframework
```

Verify the XCFramework structure:

```bash
ls -la target/RustCore.xcframework
```

Output will show two distinct slices:
- `ios-arm64` (Physical iPhone / iPad)
- `ios-arm64_x86_64-simulator` (Universal simulator covering all Mac hosts)

### 5.2 Automated Packaging Script: `rust-core/build-ios.sh`

Create `rust-core/build-ios.sh` to automate this compilation and packaging process:

```bash
#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure Cargo/Rustup are on PATH
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:$PATH"

# Note: Debug builds can be substantially slower for compute-heavy workloads.
# Benchmark optimized release builds on target hardware.
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
```

Make it executable:

```bash
chmod +x rust-core/build-ios.sh
```

---

## 6. React Native Codegen Spec & `package.json`

### `specs/NativeRustModule.ts`

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  install(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRustModule');
```

The `install()` method provides the JavaScript entry point that triggers the C++ TurboModule to register all Rust HostFunctions directly onto JavaScript's `globalThis`.

### `package.json`

Update your `package.json` root object to configure Codegen for both platforms:

```json
{
  "name": "GamePrototype",
  "version": "0.0.1",
  "codegenConfig": {
    "name": "RustModuleSpecs",
    "type": "modules",
    "jsSrcsDir": "specs",
    "android": {
      "javaPackageName": "com.rustmodule.specs"
    },
    "ios": {
      "modulesProvider": {
        "NativeRustModule": "RustModuleProvider"
      }
    }
  }
}
```

> **Why `ios.modulesProvider` is essential (RN 0.79.x):**
> In React Native 0.79, `codegenConfig.ios.modulesProvider` maps the TurboModule spec name `NativeRustModule` to the Objective-C++ provider class `RustModuleProvider` inside the generated `RCTModuleProviders.mm` registry file.
> *(Note for other releases: Official React Native documentation presents both `"ios": { "modulesProvider": ... }` and `"ios": { "modules": { "...": { "className": "..." } } }` across different versioned guides. When targeting a different RN version, consult your installed Codegen package's expected schema.)*

### Documented Codegen Output Layout

When CocoaPods runs (`pod install`), React Native Codegen generates the native spec artifacts under `build/generated/ios/`:

- **C++ JSI artifacts** (placed directly at the root):
  - `build/generated/ios/RustModuleSpecsJSI.h`
  - `build/generated/ios/RustModuleSpecsJSI-generated.cpp`
- **Objective-C++ module artifacts** (placed in the module subfolder):
  - `build/generated/ios/RustModuleSpecs/RustModuleSpecs-generated.mm`
  - `build/generated/ios/RustModuleSpecs/RustModuleSpecs.h`

---

## 7. C++ Header — `shared/NativeRustModule.h`

This header defines the pure C++ TurboModule class conforming to the generated `NativeRustModuleCxxSpec`:

```cpp
#pragma once

#if __has_include(<React-Codegen/RustModuleSpecsJSI.h>) // iOS / CocoaPods
#include <React-Codegen/RustModuleSpecsJSI.h>
#elif __has_include(<RustModuleSpecsJSI.h>) // Android / CMake
#include <RustModuleSpecsJSI.h>
#endif

#include <memory>

// Forward declaration of opaque Rust state struct.
// NativeRustModule.h does NOT include <rust_core.h>, keeping Rust C ABI headers
// private to the pod implementation and preventing header resolution failures
// in app-target translation units (e.g., RustModuleProvider.mm).
struct RustData;

namespace facebook::react {

class NativeRustModule
    : public NativeRustModuleCxxSpec<NativeRustModule> {
 public:
  explicit NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~NativeRustModule() override;

  // TurboModule method receiving the active JSI runtime
  void install(jsi::Runtime& runtime);

 private:
  // std::shared_ptr with custom deleter ensures safe, lifetime-managed native
  // state that can be captured by value in JSI HostFunctions, avoiding dangling
  // [this] pointer crashes across JS reloads/Fast Refresh.
  std::shared_ptr<RustData> data_{nullptr};
};

} // namespace facebook::react
```

> **Why the conditional include is necessary:**
> CocoaPods places Codegen-generated TurboModule headers under the namespaced header path `<React-Codegen/RustModuleSpecsJSI.h>`, whereas Android CMake places the generated spec directory directly on the include search path (`<RustModuleSpecsJSI.h>`). Using `#if __has_include` allows the exact same `NativeRustModule.h` to be shared cross-platform across both Android and iOS without modifications.

> **Header Encapsulation & Transitive App-Target Resolution:**
> `NativeRustModule.h` uses an opaque forward declaration (`struct RustData;`) instead of `#include <rust_core.h>`.
> Because `RustModuleProvider.mm` compiles as part of the **iOS application target** (`GamePrototype`), including `<rust_core.h>` in `NativeRustModule.h` would leak Rust C header dependencies into the app target. The app target compiles with its own build settings and does not inherit the pod's private `HEADER_SEARCH_PATHS` (`rust-core/include`).
> Forward-declaring `struct RustData` ensures:
> 1. `NativeRustModule.h` depends only on the standard library (`<memory>`) and Codegen interfaces (`<React-Codegen/RustModuleSpecsJSI.h>`), both of which are exposed via public CocoaPods search paths.
> 2. `rust_core.h` is included strictly within `NativeRustModule.cpp` inside the `RustModule` pod target.
> 3. `RustModuleProvider.mm` in the app target compiles cleanly without requiring `rust_core.h` on its search path.

---

## 8. C++ Implementation — `shared/NativeRustModule.cpp`

This file contains the generic C++17 binder, automatic type deduction, string safety, and buffer copying:

```cpp
#include "NativeRustModule.h"

extern "C" {
#include <rust_core.h>
}

#include <cstddef>
#include <cstdint>
#include <cmath>
#include <limits>
#include <string>
#include <type_traits>
#include <utility>
#include <cstring>

namespace facebook::react {
namespace {

using jsi::ArrayBuffer;
using jsi::Function;
using jsi::JSError;
using jsi::Object;
using jsi::PropNameID;
using jsi::Runtime;
using jsi::Value;

// Holds temporary UTF-8 storage for the duration of the C ABI call.
struct JsiStringArg {
  std::string value;
  operator const char*() const noexcept { return value.c_str(); }
};

// RAII guard ensuring Rust-allocated strings are always freed via rust_string_free,
// even if jsi::String::createFromUtf8 throws a JSError or memory exception.
struct RustStringGuard {
  char* ptr;
  explicit RustStringGuard(char* p) noexcept : ptr(p) {}
  ~RustStringGuard() {
    if (ptr != nullptr) {
      rust_string_free(ptr);
    }
  }
  RustStringGuard(const RustStringGuard&) = delete;
  RustStringGuard& operator=(const RustStringGuard&) = delete;
};

// JS value -> native C++ / C argument conversion.
template <typename T>
auto fromJsi(Runtime& runtime, const Value& value) {
  using U = std::decay_t<T>;

  if constexpr (std::is_same_v<U, const char*>) {
    if (!value.isString()) {
      throw JSError(runtime, "Expected a string argument");
    }
    return JsiStringArg{value.getString(runtime).utf8(runtime)};
  } else if constexpr (std::is_same_v<U, std::string>) {
    if (!value.isString()) {
      throw JSError(runtime, "Expected a string argument");
    }
    return value.getString(runtime).utf8(runtime);
  } else if constexpr (std::is_same_v<U, bool>) {
    if (!value.isBool()) {
      throw JSError(runtime, "Expected a boolean argument");
    }
    return value.getBool();
  } else if constexpr (std::is_floating_point_v<U>) {
    if (!value.isNumber()) {
      throw JSError(runtime, "Expected a numeric floating-point argument");
    }
    const double number = value.asNumber();

    if (!std::isfinite(number)) {
      throw JSError(
          runtime,
          "Floating-point argument must be finite (NaN and Infinity are not allowed)");
    }

    const double minTarget =
        static_cast<double>(std::numeric_limits<U>::lowest());
    const double maxTarget =
        static_cast<double>(std::numeric_limits<U>::max());

    // Validate before narrowing the value to prevent undefined behavior
    if (number < minTarget || number > maxTarget) {
      throw JSError(
          runtime,
          "Floating-point argument exceeds the target range");
    }

    return static_cast<U>(number);
  } else if constexpr (std::is_integral_v<U>) {
    // Full-width 64-bit integers can be provided as a JavaScript BigInt
    if constexpr (std::is_same_v<U, int64_t>) {
      if (value.isBigInt()) {
        return value.getBigInt(runtime).asInt64(runtime);
      }
    } else if constexpr (std::is_same_v<U, uint64_t>) {
      if (value.isBigInt()) {
        return value.getBigInt(runtime).asUint64(runtime);
      }
    }

    if (!value.isNumber()) {
      throw JSError(runtime, "Expected a numeric integer or BigInt argument");
    }

    const double number = value.asNumber();
    if (!std::isfinite(number) || number != std::trunc(number)) {
      throw JSError(runtime, "Integer argument is fractional or non-finite");
    }

    // JavaScript Number precision is limited to ±(2^53 - 1)
    constexpr double kMaxSafeInteger = 9007199254740991.0;
    constexpr double kMinSafeInteger = -9007199254740991.0;

    double lower = kMinSafeInteger;
    double upper = kMaxSafeInteger;

    if constexpr (std::is_signed_v<U>) {
      if constexpr (sizeof(U) < sizeof(int64_t)) {
        lower = static_cast<double>(std::numeric_limits<U>::lowest());
        upper = static_cast<double>(std::numeric_limits<U>::max());
      }
    } else {
      lower = 0.0;
      if constexpr (sizeof(U) < sizeof(uint64_t)) {
        upper = static_cast<double>(std::numeric_limits<U>::max());
      }
    }

    if (number < lower || number > upper) {
      throw JSError(runtime, "Integer argument is out of safe range");
    }
    return static_cast<U>(number);
  } else {
    static_assert(!sizeof(U), "Unsupported JSI argument type");
  }
}

// Native return -> JS value conversion.
//
// OWNERSHIP CONTRACT:
// `char*` is strictly reserved for dynamically allocated C strings returned
// from Rust that MUST be deallocated by rust_string_free().
// `const char*` is for borrowed/constant strings that must NOT be deallocated.
template <typename T>
Value toJsi(Runtime& runtime, T&& value) {
  using U = std::decay_t<T>;

  if constexpr (std::is_same_v<U, void>) {
    return Value::undefined();
  } else if constexpr (std::is_same_v<U, bool>) {
    return Value(static_cast<bool>(value));
  } else if constexpr (std::is_same_v<U, int64_t>) {
    // Full-width 64-bit integer returned losslessly as JavaScript BigInt
    return Value(jsi::BigInt::fromInt64(runtime, value));
  } else if constexpr (std::is_same_v<U, uint64_t>) {
    return Value(jsi::BigInt::fromUint64(runtime, value));
  } else if constexpr (std::is_floating_point_v<U>) {
    const double result = static_cast<double>(value);
    if (!std::isfinite(result)) {
      throw JSError(runtime, "Floating-point return value must be finite (NaN and Infinity are not allowed)");
    }
    return Value(result);
  } else if constexpr (std::is_integral_v<U>) {
    return Value(static_cast<double>(value));
  } else if constexpr (std::is_same_v<U, const char*>) {
    if (value == nullptr) {
      return Value::null();
    }
    return Value(jsi::String::createFromUtf8(runtime, value));
  } else if constexpr (std::is_same_v<U, char*>) {
    if (value == nullptr) {
      return Value::null();
    }
    // RAII guard frees the Rust pointer even if createFromUtf8 throws
    RustStringGuard guard{value};
    return Value(jsi::String::createFromUtf8(runtime, value));
  } else if constexpr (std::is_same_v<U, std::string>) {
    return Value(jsi::String::createFromUtf8(runtime, value));
  } else {
    static_assert(!sizeof(U), "Unsupported JSI return type");
  }
}

template <typename Ret, typename... Args, std::size_t... I>
Value invoke(
    Runtime& runtime,
    Ret (*function)(Args...),
    const Value* values,
    std::size_t count,
    std::index_sequence<I...>) {
  constexpr std::size_t expectedCount = sizeof...(Args);

  if (count != expectedCount) {
    throw JSError(
        runtime,
        "Incorrect argument count; expected " +
            std::to_string(expectedCount));
  }

  if constexpr (std::is_void_v<Ret>) {
    function(fromJsi<Args>(runtime, values[I])...);
    return Value::undefined();
  } else {
    return toJsi(
        runtime,
        function(fromJsi<Args>(runtime, values[I])...));
  }
}

// Generic C++17 binder: automatically maps function pointer signatures.
template <typename Ret, typename... Args>
void bind(
    Runtime& runtime,
    Object& target,
    const char* name,
    Ret (*function)(Args...)) {
  constexpr std::size_t arity = sizeof...(Args);

  target.setProperty(
      runtime,
      name,
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, name),
          static_cast<unsigned int>(arity),
          [function](
              Runtime& rt,
              const Value&,
              const Value* values,
              std::size_t count) -> Value {
            return invoke(
                rt,
                function,
                values,
                count,
                std::make_index_sequence<arity>{});
          }));
}

} // namespace

NativeRustModule::NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeRustModuleCxxSpec(std::move(jsInvoker)) {}

NativeRustModule::~NativeRustModule() = default;

void NativeRustModule::install(Runtime& runtime) {
  Object api(runtime);

  // Generic 1-line bindings:
  bind(runtime, api, "add", rust_add);
  bind(runtime, api, "multiply", rust_multiply);
  bind(runtime, api, "isPositive", rust_is_positive);
  bind(runtime, api, "greeting", rust_greeting);

  // Allocate stateful data structure using std::shared_ptr with custom deleter:
  if (!data_) {
    data_ = std::shared_ptr<RustData>(rust_data_create(16), rust_data_destroy);
    if (!data_) {
      throw JSError(runtime, "Could not allocate native RustData instance");
    }
  }

  // Capture shared_ptr by value so HostFunction owns a strong reference to data,
  // making it completely independent of NativeRustModule's lifetime across Fast Refresh/reload.
  api.setProperty(
      runtime,
      "setValue",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "setValue"),
          2,
          [data = this->data_](Runtime& rt, const Value&, const Value* args,
                               std::size_t count) -> Value {
            if (!data) {
              throw JSError(rt, "Native data instance is null");
            }
            if (count != 2 || !args[0].isNumber() || !args[1].isNumber()) {
              throw JSError(rt, "setValue(index, value) expects two numbers");
            }

            const double rawIndex = args[0].asNumber();
            if (!std::isfinite(rawIndex) || rawIndex < 0 || rawIndex != std::trunc(rawIndex)) {
              throw JSError(rt, "index must be a non-negative finite integer");
            }

            const double rawValue = args[1].asNumber();
            if (!std::isfinite(rawValue)) {
              throw JSError(rt, "value must be a finite floating-point number");
            }

            const double minFloat =
                static_cast<double>(std::numeric_limits<float>::lowest());
            const double maxFloat =
                static_cast<double>(std::numeric_limits<float>::max());

            // Validate before narrowing the value to prevent undefined behavior
            if (rawValue < minFloat || rawValue > maxFloat) {
              throw JSError(
                  rt,
                  "value exceeds the finite float32 range");
            }

            const float convertedValue = static_cast<float>(rawValue);

            if (rawIndex >= 16.0) {
              return Value(false);
            }

            const auto index = static_cast<std::size_t>(rawIndex);
            const bool success = rust_data_set(
                data.get(), index, convertedValue);
            return Value(success);
          }));

  // Stateful getter (copies Rust memory into JS Float32Array):
  api.setProperty(
      runtime,
      "getValues",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getValues"),
          0,
          [data = this->data_](Runtime& rt, const Value&, const Value*,
                               std::size_t count) -> Value {
            if (!data) {
              return Value::null();
            }
            if (count != 0) {
              throw JSError(rt, "getValues() does not accept arguments");
            }

            std::size_t length = 0;
            const float* source = rust_data_values(data.get(), &length);
            if (source == nullptr || length == 0) {
              return Value::null();
            }

            const std::size_t byteCount = length * sizeof(float);

            Object bufferObject = rt.global()
                .getPropertyAsFunction(rt, "ArrayBuffer")
                .callAsConstructor(rt, static_cast<double>(byteCount))
                .asObject(rt);

            ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
            std::memcpy(buffer.data(rt), source, byteCount);

            return rt.global()
                .getPropertyAsFunction(rt, "Float32Array")
                .callAsConstructor(rt, bufferObject);
          }));

  runtime.global().setProperty(runtime, "RustModule", std::move(api));
}

} // namespace facebook::react
```

### Supported Types & Precision Limit

| C++ / Rust Type | Input (JS → Native) | Return (Native → JS) | Ownership & Precision Semantics |
|---|---|---|---|
| `bool` | `boolean` | `boolean` | Checked boolean (`isBool()`) |
| `float`, `double` | `number` | `number` | **Strict contract:** Checked finite IEEE-754 floating point. Inputs and return values are validated with `std::isfinite`; narrowing overflows (e.g. 1e300 to `float`), `NaN`, and `Infinity` throw a `JSError`. |
| `int32_t`, `uint32_t`, etc. | `number` | `number` | Range & whole integer checked (`std::trunc`, bounded to type's min/max) |
| `int64_t`, `uint64_t` | Safe `number` or `bigint` | **Always** `bigint` | **Input:** Accepts a safe JavaScript `number` within \(\pm(2^{53}-1)\) (`Number.MIN_SAFE_INTEGER` to `Number.MAX_SAFE_INTEGER`) or a representable `bigint` (`asInt64`/`asUint64`). Non-finite, fractional, or out-of-range numbers throw a `JSError`.<br>**Return:** Always returns a JavaScript `bigint` (`BigInt::fromInt64` / `BigInt::fromUint64`) to prevent silent precision loss. |
| `void` | — | `undefined` | No return conversion |
| `const char*` (parameter) | `string` | — | `JsiStringArg` allocates temporary UTF-8 buffer valid for the duration of the C ABI call |
| `char*` (return) | — | `string` or `null` | **Ownership transfer:** Caller takes ownership; wrapped in `RustStringGuard` and freed immediately with `rust_string_free()`, even if JSI throws. |
| `const char*` (return) | — | `string` or `null` | **Borrowed string:** Must point to static or valid caller-persisted memory for call duration; NOT freed by C++. |
| `std::string` | `string` | `string` | C++ adapter functions only; never pass `std::string` directly across Rust's C ABI |

> **RAII Exception Safety for Rust Strings:**
> In C ABI boundaries, functions returning `char*` transfer heap ownership allocated by Rust (`CString::into_raw()`) to C++.
> In a naive sequential implementation:
> ```cpp
> auto jsString = jsi::String::createFromUtf8(runtime, value);
> rust_string_free(value); // SKIPPED if createFromUtf8 throws!
> return Value(std::move(jsString));
> ```
> If `jsi::String::createFromUtf8` throws an exception (e.g. if the byte sequence is invalid UTF-8 or the JS engine hits memory exhaustion), the sequential `rust_string_free(value)` call is skipped during exception unwinding, causing an irrecoverable native memory leak.
>
> By wrapping `value` in `RustStringGuard guard{value}`:
> 1. **On Exception:** If `createFromUtf8` throws, C++ stack unwinding invokes `~RustStringGuard()`, guaranteeing `rust_string_free(ptr)` executes.
> 2. **On Success:** Upon normal return, the guard goes out of scope and frees the Rust pointer after the JavaScript engine has finished copying the UTF-8 bytes into its managed heap.

---

## 9. TypeScript wrapper

### `src/RustModule.ts`

```ts
import NativeRustModule from '../specs/NativeRustModule';

export interface RustModuleApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
  isPositive(value: number): boolean;
  greeting(name: string): string | null;
  setValue(index: number, value: number): boolean;
  getValues(): Float32Array | null;
}

declare global {
  // Installed by the native C++ install() method.
  var RustModule: RustModuleApi | undefined;
}

// Calls C++ TurboModule install() method to bind HostFunctions to globalThis
NativeRustModule.install();

const moduleInstance = globalThis.RustModule;
if (!moduleInstance) {
  throw new Error(
    'RustModule installation failed. Check Codegen, native registration, and iOS linking.',
  );
}

export const RustModule: RustModuleApi = moduleInstance;
export default RustModule;
```

---

## 10. Configure iOS: CocoaPods & Podspec

To link the `RustCore.xcframework` built in Section 5 consistently into the iOS project, create `RustModule.podspec` at the project root:

### `RustModule.podspec`

```ruby
require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name            = "RustModule"
  s.version         = package["version"]
  s.summary         = "Rust integration for React Native via pure C++ TurboModule"
  s.homepage        = "https://github.com/example/react-native-rust-integration"
  s.license         = "MIT"
  s.author          = { "Your Name" => "developer@example.com" }
  s.platforms       = { :ios => "15.1" }
  
  # Valid production source configuration (overridden locally by Podfile :path)
  s.source          = { :git => "https://github.com/example/react-native-rust-integration.git", :tag => "v#{s.version}" }

  # Compile only cross-platform C++ implementation and headers
  s.source_files    = "shared/**/*.{h,cpp}"

  # Expose shared C++ headers publicly so the app target and provider (.mm)
  # can import NativeRustModule.h through CocoaPods header maps
  s.public_header_files = "shared/**/*.h"

  # Vendor the XCFramework generated in Section 5
  s.vendored_frameworks = "rust-core/target/RustCore.xcframework"

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "HEADER_SEARCH_PATHS" => "\"$(inherited)\" \"$(PODS_TARGET_SRCROOT)/shared\" \"$(PODS_TARGET_SRCROOT)/rust-core/include\""
  }

  # CocoaPods Best Practice:
  # user_target_xcconfig is omitted by default because CocoaPods discourages modifying the
  # host app project's global build settings. The host app resolves NativeRustModule.h via
  # modular imports (#import <RustModule/NativeRustModule.h>) automatically through
  # $(PODS_ROOT)/Headers/Public without polluting user_target_xcconfig.
  # If your target setup strictly requires flat imports ("NativeRustModule.h"), uncomment:
  # s.user_target_xcconfig = {
  #   "HEADER_SEARCH_PATHS" => "\"$(inherited)\" \"$(PODS_ROOT)/Headers/Public/RustModule\""
  # }

  # Link React Native New Architecture dependencies
  install_modules_dependencies(s)
end
```

> **Note on metadata:**
> Replace the placeholder `https://github.com/example/react-native-rust-integration` URL and author details with your actual repository information before publishing or distributing this pod.

> **Clean Architectural Separation & Header Search Path Verification:**
> - `shared/` contains strictly cross-platform C++ code (`NativeRustModule.h`, `NativeRustModule.cpp`), reused across both iOS and Android.
> - `ios/GamePrototype/` contains the iOS-specific provider files (`RustModuleProvider.h`, `RustModuleProvider.mm`), compiled as part of the iOS application target.
> - **Pod vs App Header Resolution:**
>   - **`s.pod_target_xcconfig`**: Applies exclusively to the `RustModule` pod target. It includes `"$(PODS_TARGET_SRCROOT)/rust-core/include"` and `"$(PODS_TARGET_SRCROOT)/shared"`, allowing `NativeRustModule.cpp` to include `<rust_core.h>` and compile the C ABI calls.
>   - **Public Header Resolution:** CocoaPods automatically adds `"$(PODS_ROOT)/Headers/Public"` to the host target's `HEADER_SEARCH_PATHS`. Because `s.public_header_files = "shared/**/*.h"` is declared, `RustModuleProvider.mm` cleanly resolves `<RustModule/NativeRustModule.h>` without needing `s.user_target_xcconfig`.
>   - **Transitive Header Encapsulation:** Because `NativeRustModule.h` forward-declares `struct RustData;` instead of including `<rust_core.h>`, `RustModuleProvider.mm` in the app target only resolves `NativeRustModule.h` and Codegen specs. The app target has zero dependency on `rust_core.h`, completely avoiding transitive header resolution failures.

> [!TIP]
> **CocoaPods Best Practice on `s.user_target_xcconfig`:**
> [CocoaPods explicitly discourages `user_target_xcconfig`](https://guides.cocoapods.org/syntax/podspec.html#user_target_xcconfig) because it pollutes the host project's build settings (`Pods-GamePrototype.debug.xcconfig`) and can affect other integrated pods.
> - **Modular Header Resolution (Default):** In `RustModuleProvider.mm`, using modular imports:
>   ```objc
>   #import <RustModule/NativeRustModule.h>
>   ```
>   resolves automatically because CocoaPods already adds `$(PODS_ROOT)/Headers/Public` to the host target's `HEADER_SEARCH_PATHS` for any pod declaring `s.public_header_files`. Thus, `s.user_target_xcconfig` is omitted by default.
> - **Fallback for Flat Imports:** If your app target strictly requires non-modular flat `#import "NativeRustModule.h"` resolution, uncomment `s.user_target_xcconfig` in `RustModule.podspec`. If enabled, always inspect `Pods-GamePrototype.*.xcconfig` to verify `HEADER_SEARCH_PATHS` preserves `$(inherited)` and introduces no header collisions.

> **Why `vendored_frameworks` is the consistent strategy:**
> CocoaPods natively inspects `RustCore.xcframework`. It automatically links the device slice for `iphoneos` and the universal simulator slice for `iphonesimulator`, automatically exposes the packaged `include/rust_core.h` header, and avoids manual `LIBRARY_SEARCH_PATHS` flags or arch-mismatch linker failures.

### `ios/Podfile`

In `ios/Podfile`, include the local pod:

```ruby
target 'GamePrototype' do
  config = use_native_modules!

  # Include the Rust C++ TurboModule pod
  pod 'RustModule', :path => '../'

  use_react_native!(
    :path => config[:reactNativePath],
    :app_path => "#{Pod::Config.instance.installation_root}/.."
  )

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false
    )
  end
end
```

---

## 11. Register the C++ TurboModule via `RustModuleProvider` (RN 0.79.x Documented Approach)

In React Native 0.79.x, the documented, standard approach to register a pure C++ TurboModule on iOS is through an Objective-C++ `ModuleProvider` class conforming to `RCTModuleProvider`.

When Codegen runs, it reads the `ios.modulesProvider` mapping from `package.json`:
```json
"ios": {
  "modulesProvider": {
    "NativeRustModule": "RustModuleProvider"
  }
}
```
This automatically registers `RustModuleProvider` into React Native's generated `RCTModuleProviders`. No modifications to `AppDelegate.swift` or `AppDelegate.mm` are required.

> **Note on Codegen Schema Variants Across Releases:**
> Official React Native documentation exhibits variance across releases and documentation pages (for instance, the versioned Pure C++ guide versus the standalone Codegen guide):
>
> | Schema Variant | `package.json` Codegen Configuration |
> |---|---|
> | **Flat `modulesProvider`** (RN 0.79.x standard) | `"ios": { "modulesProvider": { "NativeRustModule": "RustModuleProvider" } }` |
> | **Nested `modules`** | `"ios": { "modules": { "NativeRustModule": { "className": "RustModuleProvider" } } }` |
>
> This guide standardizes on the documented RN 0.79 flat `modulesProvider` syntax. If you are targeting another release, inspect the Codegen generation output or official documentation for your specific version rather than assuming a single migration boundary.

### 11.1 `ios/GamePrototype/RustModuleProvider.h`

```objc
#import <Foundation/Foundation.h>
#import <ReactCommon/RCTTurboModule.h>

NS_ASSUME_NONNULL_BEGIN

@interface RustModuleProvider : NSObject <RCTModuleProvider>
@end

NS_ASSUME_NONNULL_END
```

### 11.2 `ios/GamePrototype/RustModuleProvider.mm`

```objc
#import "RustModuleProvider.h"
#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/TurboModule.h>

#if __has_include(<RustModule/NativeRustModule.h>)
#import <RustModule/NativeRustModule.h>
#elif __has_include("NativeRustModule.h")
#import "NativeRustModule.h"
#endif

@implementation RustModuleProvider

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRustModule>(params.jsInvoker);
}

@end
```

### Target Membership & Transitive Header Verification
The separation across platforms is now clean and modular:
- **Cross-platform C++ Core (`shared/`):** Contains `NativeRustModule.h` and `NativeRustModule.cpp`. This is strictly platform-agnostic C++17 JSI code compiled by CMake on Android and by CocoaPods (`RustModule.podspec`) on iOS.
- **iOS App-Level Provider (`ios/GamePrototype/`):** Contains `RustModuleProvider.h` and `RustModuleProvider.mm`.
  1. **Compile Sources Membership:** Ensure `RustModuleProvider.mm` is added to your iOS app target (`GamePrototype`) under **Build Phases > Compile Sources** in Xcode (`project.pbxproj`).
  2. **App-Target Header Resolution:** `RustModuleProvider.mm` imports `<RustModule/NativeRustModule.h>`. This is resolved automatically via CocoaPods default `$(PODS_ROOT)/Headers/Public` search path and `s.public_header_files = "shared/**/*.h"`, without requiring `s.user_target_xcconfig`.
  3. **Transitive Header Encapsulation (Eliminating `rust_core.h` leakage):** `NativeRustModule.h` uses a forward declaration `struct RustData;` and does NOT include `<rust_core.h>`. This guarantees that the app-target translation unit does not transitively depend on `rust_core.h` (which is only present in the pod's private search paths). `#include <rust_core.h>` is restricted entirely to `NativeRustModule.cpp` within the pod target.
  4. **Runtime Instantiation:** React Native Codegen generates `RCTModuleProviders.mm`, which resolves the provider dynamically via `[NSClassFromString(@"RustModuleProvider") new]`. Because `RustModuleProvider` is compiled directly into the application binary, it is guaranteed to be present in the Objective-C runtime class registry.
- **Android App-Level Registration (`android/`):** Uses standard `OnLoad.cpp` via CMake for its own registration.

---

## 12. Rebuild Strategy & Workflow

Because we use a prebuilt **XCFramework** containing both device and simulator slices, Xcode automatically links the appropriate slice, eliminating multi-architecture `$ARCHS` build-script bugs.

### Supported Rebuild Workflow: `package.json` Pre-Build Scripts

The cleanest, deterministic workflow in React Native development and CI/CD pipelines is to trigger the Rust build prior to launching the iOS build:

In `package.json`:

```json
{
  "scripts": {
    "build:rust": "cd rust-core && ./build-ios.sh",
    "ios": "npm run build:rust && react-native run-ios"
  }
}
```

Running `npm run ios` ensures the XCFramework is compiled and placed in `rust-core/target/RustCore.xcframework` before CocoaPods or Xcode inspects or links the vendored framework.

> **Why Pre-Build Scripting is Recommended Over In-IDE Run Scripts:**
> Attempting to rebuild a CocoaPods `vendored_frameworks` binary from an Xcode app-target Run Script phase introduces build ordering races: CocoaPods target dependencies and linker input resolution often evaluate framework artifacts before an app-target script executes. Running `build:rust` as an explicit pre-build step guarantees deterministic framework linkage across clean checkouts, CI/CD runners, and local builds.

---

## 13. Build and test in stages

### Step 1: Build the XCFramework

From the project root:

```bash
cd rust-core
./build-ios.sh
cd ..
```

Verify that the XCFramework exists:

```bash
ls -la rust-core/target/RustCore.xcframework
```

### Step 2: Install CocoaPods & Run Codegen

```bash
cd ios
pod install
cd ..
```

Check the terminal output: CocoaPods will execute React Native Codegen and link `RustModule`.

### Step 3: Run the App on iOS Simulator

```bash
npx react-native run-ios --simulator "iPhone 16"
```

Or open `ios/GamePrototype.xcworkspace` in Xcode and click **Run**.

### Step 4: Verify in JavaScript / React Native

In `App.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { RustModule } from './src/RustModule';

export default function App() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [sum, setSum] = useState<number>(0);
  const [values, setValues] = useState<Float32Array | null>(null);

  useEffect(() => {
    // 1. Call scalar Rust functions
    setSum(RustModule.add(20, 22));

    // 2. Call string Rust function
    setGreeting(RustModule.greeting('iOS Native'));

    // 3. Stateful buffer operations
    RustModule.setValue(0, 100.5);
    RustModule.setValue(1, 200.75);
    setValues(RustModule.getValues());
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>React Native + Rust (iOS)</Text>
      <Text style={styles.text}>Sum (20 + 22): {sum}</Text>
      <Text style={styles.text}>Greeting: {greeting}</Text>
      <Text style={styles.text}>
        Values[0..2]: {values ? `${values[0]}, ${values[1]}` : 'None'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#f8fafc', marginBottom: 16 },
  text: { fontSize: 16, color: '#94a3b8', marginVertical: 4 },
});
```

### Verification Checklist

- [ ] `cargo check` succeeds.
- [ ] iOS targets installed: `aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios`.
- [ ] `RustCore.xcframework` contains both `ios-arm64` and `ios-arm64_x86_64-simulator`.
- [ ] `pod install` finishes without errors.
- [ ] `RustModuleProvider.mm` included in `GamePrototype` app target's **Build Phases → Compile Sources**.
- [ ] `NativeRustModule.cpp` compiled and linked by CocoaPods (`RustModule` pod).
- [ ] `RustModule.install()` completes during JS initialization.
- [ ] Rust scalar results (`add`, `multiply`, `isPositive`) match expected values.
- [ ] Strings allocated by Rust (`rust_greeting`) are freed by `rust_string_free` in C++ without leaks.
- [ ] Stateful `getValues()` returns the correct `Float32Array`.
- [ ] App reload (Cmd + R) works without stale-pointer or double-free crashes.

---

## 14. Memory buffers: copy vs zero-copy & Concurrency

In `getValues()`:

```cpp
Object bufferObject = rt.global()
    .getPropertyAsFunction(rt, "ArrayBuffer")
    .callAsConstructor(rt, static_cast<double>(byteCount))
    .asObject(rt);

ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
std::memcpy(buffer.data(rt), source, byteCount);
```

1. Rust returns a pointer to its contiguous heap `Vec<f32>` and its element count.
2. C++ constructs a JavaScript-owned `ArrayBuffer` on the Hermes heap.
3. C++ copies the bytes with `std::memcpy`.
4. C++ wraps it in a JavaScript `Float32Array`.

**This implementation is an explicit COPY.**

### Concurrency and Thread Safety
In this sample, all calls (`setValue`, `getValues`) run synchronously on the **single JavaScript/JSI thread**, so memory access is strictly sequential.

However, copying with `std::memcpy` **does NOT** make multi-threaded access automatically safe:
- **`memcpy` can race with concurrent writers:** If a background thread mutates or reallocates the `Vec<f32>` in Rust while `memcpy` is reading from it, a data race or torn read occurs.
- **`memcpy` can cause a use-after-free:** If another thread calls `rust_data_destroy` or deallocates the vector while `memcpy` is executing, `memcpy` accesses dangling memory.
- **Required synchronization:** If you extend this architecture to allow background threads or async tasks to access `RustData`, all reads (`rust_data_values` + `memcpy`), writes (`rust_data_set`), and deallocation (`rust_data_destroy`) **must be synchronized** (e.g., using a `std::mutex` in C++ or a `parking_lot::RwLock` / `std::sync::Mutex` inside Rust).

What the explicit copy **does** protect is the **JavaScript side after the call returns**:
The returned JavaScript `Float32Array` owns its memory on the Hermes heap. Subsequent mutations or destruction of `RustData` on the native side will not corrupt, invalidate, or mutate the array already delivered to JavaScript.

### Integer Precision Limits
JavaScript numbers are IEEE-754 double-precision floats. Integer values larger than \(2^{53}-1\) (`Number.MAX_SAFE_INTEGER`, 9,007,199,254,740,991) cannot be represented with exact precision by a JavaScript `number`. For 64-bit integers (e.g., 64-bit database IDs, timestamps in nanoseconds, or uint64 counters), return them as strings or pass them as BigInt / byte arrays.

---

## 15. Common errors and troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| `RustCore.xcframework: No such file or directory` | Rust build script was not run before `pod install`. | Run `./rust-core/build-ios.sh` to generate the XCFramework, then rerun `pod install`. |
| `fatal error: 'rust_core.h' file not found` | Header not included in XCFramework. | Verify `xcodebuild -create-xcframework` received `-headers include`. |
| `building for iOS Simulator, but linking in object file built for iOS` | Mach-O LC_BUILD_VERSION mismatch. | Packaging into `RustCore.xcframework` with both `ios-arm64` and `ios-arm64_x86_64-simulator` resolves this automatically. |
| `Undefined symbol: _rust_add` | XCFramework not linked in Podfile / Xcode target. | Verify `s.vendored_frameworks = "rust-core/target/RustCore.xcframework"` is in your podspec. |
| `fatal error: 'React-Codegen/RustModuleSpecsJSI.h' file not found` | React Native Codegen has not run yet. | Use `#if __has_include` in `NativeRustModule.h` and run `cd ios && pod install` to generate Codegen headers. |
| `fatal error: 'NativeRustModule.h' file not found` | `RustModule.podspec` did not declare public headers. | Add `s.public_header_files = "shared/**/*.h"` to `RustModule.podspec` and rerun `pod install`. |
| `RustModule installation failed. Check Codegen, native registration...` | `RustModuleProvider` not found at runtime or not in Compile Sources. | Verify `RustModuleProvider.mm` is in `GamePrototype` target's **Compile Sources** and `codegenConfig.ios.modulesProvider` maps `"NativeRustModule": "RustModuleProvider"`. |
| Shell error: `cargo: command not found` | Cargo / Rustup is not in the active shell's `$PATH`. | Ensure Rust is installed via `rustup`, verify `$HOME/.cargo/bin` is in your `$PATH` (e.g. in `~/.zshrc` or exported in `build-ios.sh`), and run `npm run build:rust`. |

---

## 16. Performance benchmarking on iOS

When benchmarking Rust against Hermes on iOS:

1. **Test on Physical Devices:** Simulator and physical-device measurements are not directly interchangeable; use a physical device for final performance comparisons.
2. **Build the Entire App in Release Mode:**
   ```bash
   npx react-native run-ios --mode Release
   ```
   In this guide, `build-ios.sh` intentionally builds the Rust static libraries with `--release` by default for high native speed. However, when running the app in Debug mode, Hermes runs without bytecode optimizations, and React devtools/inspector overhead dominates. For realistic benchmarks, ensure the entire React Native app is running in Release mode.
3. **Use Instruments:** Use Xcode's **Instruments > Time Profiler** to measure actual CPU time spent in Rust native code vs JSI conversion overhead.
4. **Warm Up the Engine:** Run several iterations before recording timestamps with `performance.now()`.

---

## 17. Adding more functions

To add a new function (e.g. `subtract`):

1. **Export from Rust** in `rust-core/src/lib.rs`:
   ```rust
   #[unsafe(no_mangle)]
   pub extern "C" fn rust_subtract(a: f64, b: f64) -> f64 {
       a - b
   }
   ```
2. **Rebuild the XCFramework**:
   ```bash
   ./rust-core/build-ios.sh
   ```
3. **Register in C++** (`shared/NativeRustModule.cpp` inside `install`):
   ```cpp
   bind(runtime, api, "subtract", rust_subtract);
   ```
4. **Update TypeScript wrapper** (`src/RustModule.ts`):
   ```ts
   export interface RustModuleApi {
     // ...
     subtract(a: number, b: number): number;
   }
   ```
5. **Call from JavaScript**:
   ```ts
   const result = RustModule.subtract(10, 4); // 6
   ```

No Objective-C/Swift boilerplate or manual HostFunction mapping is required for supported scalar types.
