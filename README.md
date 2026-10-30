# React Native + Rust Integration — Unified Cross-Platform Guide (Android & iOS)

A complete, production-ready guide to integrating Rust into a bare React Native application using C++17, JSI, and C++ TurboModules across both **Android** and **iOS**.

Where steps are identical (Rust core, Codegen, TypeScript API, and shared C++ JSI binder), they are unified into single cross-platform files. Where steps diverge (compilation, toolchains, CMake vs CocoaPods, and module registration), platform-specific instructions are clearly labeled.

---

## 1. Architecture Overview

### JavaScript Call Interface
Your JavaScript / TypeScript application will call:

```ts
import { RustModule } from './src/RustModule';

RustModule.add(20, 22);              // 42
RustModule.multiply(6, 7);           // 42
RustModule.isPositive(5);            // true
RustModule.greeting("Alex");         // "Hello, Alex!"
RustModule.setValue(0, 12.5);        // true
RustModule.getValues();              // Float32Array copied safely from Rust memory
```

### Call Flow
```text
TypeScript / JavaScript
       │
       │ NativeRustModule.install()
       ▼
C++ TurboModule method receives a live jsi::Runtime&
       │
       │ installs RustModule HostFunctions onto globalThis
       ▼
C++ Generic JSI Binder (Type deduction + Exception-safe RAII)
       │
       │ C ABI call (extern "C")
       ▼
Rust Static Library (.a / .xcframework)
```

Adding an ordinary scalar function requires **only 1 line** in C++:
```cpp
bind(runtime, api, "subtract", rust_subtract);
```

### Component Matrix

| Component | Shared or OS-Specific? | Description |
|---|---|---|
| **App Code & Wrapper** | **Shared** | TypeScript interface (`src/RustModule.ts`) and Codegen spec (`specs/NativeRustModule.ts`) |
| **Hermes & JSI** | **Shared** | Direct C++ JavaScript Interface (no JSON serialization bridge) |
| **C++ Header (`shared/`)** | **Shared** | `NativeRustModule.h` uses `#if __has_include` and forward declarations |
| **C++ Implementation (`shared/`)** | **Shared** | `NativeRustModule.cpp` (generic binder, RAII string guard, `std::shared_ptr` state) |
| **Rust Core (`rust-core/`)** | **Shared** | C ABI exports, `build.rs`, `cbindgen.toml`, `lib.rs` (Edition 2024) |
| **Android Toolchain** | 🤖 **Android only** | `cargo-ndk` compiling to 4 target triples, linked via Android NDK CMake |
| **iOS Toolchain** | 🍎 **iOS only** | `cargo build` compiling to 3 target triples, bundled via `lipo` into `RustCore.xcframework` |
| **Android Registration** | 🤖 **Android only** | `OnLoad.cpp` (`cxxModuleProvider`) |
| **iOS Registration** | 🍎 **iOS only** | `RustModuleProvider.mm` (`<RCTModuleProvider>`) in `package.json.codegenConfig.ios` |

---

## 2. Prerequisites & Compatibility Matrix

### Verified Compatibility Matrix (React Native 0.88.1)

| Tool / Environment | RN 0.88.1 Requirement | Notes |
| :--- | :--- | :--- |
| **Node.js** | 22.13+ / 24.3+ / 26+ | Recommended LTS |
| **JDK** | 17 | Java 17 LTS required by Gradle 9 |
| **Gradle** | 9.4.1 | React Native 0.88 wrapper default |
| **Xcode** | 26.0+ | Required by React Native 0.88.1 |
| **iOS Deployment Target** | 15.1+ | Minimum deployment target |
| **Android Min SDK** | 24 | Android 7.0 (Nougat) |
| **Android Compile SDK** | 37 | Android SDK build target |
| **Android Target SDK** | 36 | Android target API level |
| **Rust Toolchain** | Rust 1.85+ | Required for `edition = "2024"` |

> [!NOTE]
> **Rust 2024 Edition Requirement:**
> The `rust-core` library configuration specifies `edition = "2024"`. Rust 2024 edition requires a modern Rust toolchain (Rust 1.85.0 or newer). Update your toolchain via `rustup update` before compiling.

* Rust installed via `rustup` (`rustc --version`, `cargo --version`)
* A working **bare React Native** project (**React Native 0.88.x**, New Architecture enabled)

> [!IMPORTANT]
> **React Native Version Specificity & Codegen Schema Variance:**
>
> While the Rust C ABI and C++ generic JSI binder remain identical across React Native releases, native module registration schemas in `@react-native/codegen` differ strictly across versions:
>
> - **React Native 0.88.0+ (Modern Standard - Used in this project):**
>   Requires the nested `modules` schema:
>   ```json
>   "ios": {
>     "modules": {
>       "NativeRustModule": {
>         "className": "RustModuleProvider"
>       }
>     }
>   }
>   ```
> - **React Native 0.79.x (Legacy Flat Schema):**
>   Used the older flat `modulesProvider` mapping:
>   ```json
>   "ios": {
>     "modulesProvider": {
>       "NativeRustModule": "RustModuleProvider"
>     }
>   }
>   ```
>
> **Compatibility Warning**: The flat `modulesProvider` schema is strictly **incompatible** with React Native 0.88+. In React Native 0.88+, `@react-native/codegen` enforces schema validation during `pod install`; providing the flat syntax will cause CocoaPods spec generation to throw schema validation errors. If targeting React Native 0.88+, you must use the nested `modules` block with `className`.

---

### 🤖 Android Prerequisites
Install Android Studio, Android SDK, and Android NDK (through SDK Manager).
Install `cargo-ndk`:
```bash
cargo install cargo-ndk
```

Add the 4 Android Rust target triples:
```bash
rustup target add aarch64-linux-android x86_64-linux-android armv7-linux-androideabi i686-linux-android
```

> **Automatic NDK Detection vs. Manual Environment Variables:**
> `cargo-ndk` automatically detects standard Android Studio NDK installations if `ANDROID_HOME` or `ANDROID_SDK_ROOT` is configured in your environment.
>
> If you have multiple NDKs installed or need to enforce a specific version, export `ANDROID_NDK_HOME` (or `NDK_HOME`) using the platform-appropriate path:
>
> - **macOS** (`~/.zshrc` or `~/.bashrc`):
>   ```bash
>   export ANDROID_NDK_HOME="$HOME/Library/Android/sdk/ndk/<installed-ndk-version>"
>   ```
> - **Linux** (`~/.bashrc`):
>   ```bash
>   export ANDROID_NDK_HOME="$HOME/Android/Sdk/ndk/<installed-ndk-version>"
>   ```
> - **Windows** (PowerShell / System Environment Variables):
>   ```powershell
>   $env:ANDROID_NDK_HOME = "$env:LOCALAPPDATA\Android\Sdk\ndk\<installed-ndk-version>"
>   ```
>   or in Command Prompt:
>   ```cmd
>   set ANDROID_NDK_HOME=%LOCALAPPDATA%\Android\Sdk\ndk\<installed-ndk-version>
>   ```

---

### 🍎 iOS Prerequisites
* macOS with Xcode 26.0+ and Command Line Tools (`xcode-select --install`)
* CocoaPods (`pod --version`)

Add the 3 iOS Rust target triples:
```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
```

> **Why separate device and simulator targets are needed:**
> Even though physical iPhones and Apple Silicon Mac simulators are both 64-bit ARM (`arm64`), they use different Mach-O ABI platforms (`LC_BUILD_VERSION` platform 2 vs 7). Bundling them into an `XCFramework` guarantees Xcode always links the correct slice.

---

## 3. Project Directory Structure

```text
BrickBreaker/                          # (Or <YourProjectName>/)
├── android/
│   ├── gradle.properties
│   └── app/
│       ├── build.gradle               # [Android] Invokes cargo-ndk before CMake
│       └── src/main/jni/
│           ├── CMakeLists.txt         # [Android] Compiles shared/ and links librust_core.a
│           └── OnLoad.cpp             # [Android] Registers NativeRustModule
├── ios/
│   ├── Podfile                        # [iOS] Links local RustModule pod
│   └── BrickBreaker/                  # (Or <YourProjectName>/)
│       ├── RustModuleProvider.h       # [iOS] TurboModule provider interface
│       └── RustModuleProvider.mm      # [iOS] Objective-C++ provider class
├── rust-core/
│   ├── Cargo.toml                     # Rust 2024 edition, panic = "abort"
│   ├── cbindgen.toml                  # C bindings config
│   ├── build.rs                       # Auto-generates rust_core.h
│   ├── build-android.sh               # [Android] Compiles target/ ABIs via cargo-ndk
│   ├── build-ios.sh                   # [iOS] Packages target/RustCore.xcframework
│   ├── include/                       # Auto-generated: rust_core.h
│   └── src/
│       └── lib.rs                     # Rust C ABI functions
├── shared/
│   ├── NativeRustModule.h             # Unified cross-platform C++ header
│   └── NativeRustModule.cpp           # Unified cross-platform JSI binder & FFI
├── specs/
│   └── NativeRustModule.ts            # Codegen TurboModule specification
├── src/
│   └── RustModule.ts                  # TypeScript typed wrapper & global trigger
├── RustModule.podspec                 # [iOS] Vendors RustCore.xcframework & compiles shared/
├── App.tsx
└── package.json                       # Codegen configuration for Android & iOS
```

Create shared and platform directories from the root:
```bash
mkdir -p rust-core/src rust-core/include shared specs src
mkdir -p android/app/src/main/jni
```

---

## 4. Shared Rust Library (`rust-core`)

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

# Enforce panic = "abort" across all profiles to prevent unwinding across the C ABI
[profile.dev]
panic = "abort"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = 3
```

### 4.2 `rust-core/cbindgen.toml`

```toml
language = "C"
cpp_compat = true
include_guard = "RUST_CORE_H"
autogen_warning = "/* Generated by cbindgen. Do not edit manually. */"
```

### 4.3 `rust-core/build.rs`

```rust
use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR is not set"),
    );

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

### 4.4 `rust-core/src/lib.rs`

```rust
use std::ffi::{c_char, CStr, CString};
use std::ptr;

// ---------- Stateless arithmetic examples ----------

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

// ---------- String allocation & ownership transfer ----------

/// Takes a NUL-terminated UTF-8 C string and returns a newly allocated
/// C string. The caller MUST free the returned pointer using rust_string_free().
///
/// # Safety
/// `name` must be null or point to a readable NUL-terminated string.
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

---

## 5. Building the Rust Library (OS-Specific)

### 🤖 5.1 Android Build Script (`rust-core/build-android.sh`)
Create `rust-core/build-android.sh`:

```bash
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
```

Make it executable and run it:
```bash
chmod +x rust-core/build-android.sh
./rust-core/build-android.sh
```

Outputs static archives into:
* `rust-core/target/aarch64-linux-android/release/librust_core.a`
* `rust-core/target/x86_64-linux-android/release/librust_core.a`
* `rust-core/target/armv7-linux-androideabi/release/librust_core.a`
* `rust-core/target/i686-linux-android/release/librust_core.a`

---

### 🍎 5.2 iOS Build Script (`rust-core/build-ios.sh`)
Create `rust-core/build-ios.sh`:

```bash
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
```

Make it executable and run it:
```bash
chmod +x rust-core/build-ios.sh
./rust-core/build-ios.sh
```

---

## 6. Codegen Specification & `package.json`

### 6.1 `specs/NativeRustModule.ts`

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  install(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRustModule');
```

### 6.2 `package.json`

Add `codegenConfig` with mappings for **both** Android and iOS:

#### React Native 0.88+ (Modern Standard):
```json
{
  "name": "BrickBreaker",
  "version": "0.0.1",
  "scripts": {
    "build:rust:android": "cd rust-core && ./build-android.sh",
    "build:rust:ios": "cd rust-core && ./build-ios.sh",
    "ios": "npm run build:rust:ios && react-native run-ios",
    "android": "react-native run-android"
  },
  "codegenConfig": {
    "name": "RustModuleSpecs",
    "type": "modules",
    "jsSrcsDir": "specs",
    "android": {
      "javaPackageName": "com.rustmodule.specs"
    },
    "ios": {
      "modules": {
        "NativeRustModule": {
          "className": "RustModuleProvider"
        }
      }
    }
  }
}
```

> [!WARNING]
> **Codegen Schema Variance Across Releases:**
> - **React Native 0.88.0+ (Strict Requirement):**
>   Modern `@react-native/codegen` strictly requires the nested `modules` block:
>   ```json
>   "ios": {
>     "modules": {
>       "NativeRustModule": {
>         "className": "RustModuleProvider"
>       }
>     }
>   }
>   ```
> - **React Native 0.79.x (Legacy):**
>   Earlier versions used the flat `modulesProvider` mapping:
>   ```json
>   "ios": {
>     "modulesProvider": {
>       "NativeRustModule": "RustModuleProvider"
>     }
>   }
>   ```
>
> **Notice on Compatibility**: The flat `modulesProvider` schema is **completely incompatible with React Native 0.88+**. Running `pod install` with the flat syntax on RN 0.88+ causes CocoaPods Codegen validation to fail immediately. Always use the nested `modules` schema with `className` when on React Native 0.88+.

---

## 7. Unified C++ Header — `shared/NativeRustModule.h`

This header is shared 1:1 across Android and iOS. It encapsulates native headers and uses `std::shared_ptr` to prevent dangling pointers.

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
// private to NativeRustModule.cpp and preventing header resolution failures
// in iOS app-target translation units (e.g. RustModuleProvider.mm).
struct RustData;

namespace facebook::react {

class NativeRustModule
    : public NativeRustModuleCxxSpec<NativeRustModule> {
 public:
  explicit NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~NativeRustModule() override;

  // Codegen's C++ TurboModule method receives the active runtime.
  void install(jsi::Runtime& runtime);

 private:
  // std::shared_ptr with custom deleter ensures safe, lifetime-managed native
  // state that can be captured by value in JSI HostFunctions, avoiding dangling
  // [this] pointer crashes across JS reloads/Fast Refresh.
  std::shared_ptr<RustData> data_{nullptr};
};

} // namespace facebook::react
```

---

## 8. Unified C++ Implementation — `shared/NativeRustModule.cpp`

This file handles generic JSI type mapping, BigInt conversion, RAII string deallocation, and buffer copying:

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

// Holds temporary UTF-8 storage for the duration of the C ABI call.
struct JsiStringArg {
  std::string value;
  operator const char*() const noexcept { return value.c_str(); }
};

// JS value -> native argument.
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

    if (number < minTarget || number > maxTarget) {
      throw JSError(
          runtime,
          "Floating-point argument exceeds the target range");
    }

    return static_cast<U>(number);
  } else if constexpr (std::is_integral_v<U>) {
    // 64-bit integers supported via JavaScript BigInt
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

// Native return -> JS value.
template <typename T>
Value toJsi(Runtime& runtime, T&& value) {
  using U = std::decay_t<T>;

  if constexpr (std::is_same_v<U, void>) {
    return Value::undefined();
  } else if constexpr (std::is_same_v<U, bool>) {
    return Value(static_cast<bool>(value));
  } else if constexpr (std::is_same_v<U, int64_t>) {
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

  // Stateful getter: copies Rust memory into JS Float32Array (Safe synchronous copy)
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

> [!TIP]
> **Performance Optimization for High-Frequency Render Loops (60/120 FPS): TypedArray Constructor Caching**
>
> In high-frequency game loops, physics simulations, particle engines, or audio synthesizers calling typed array getters (`getValues()`, `getBalls()`, `getBricks()`) 60 to 120 times every second, standard JSI reflection introduces unnecessary overhead:
>
> ```cpp
> // UNOPTIMIZED PATTERN (DO NOT USE IN 60/120 FPS HOT LOOPS):
> // Every frame, Hermes must:
> // 1. Hash the strings "ArrayBuffer" and "Float32Array"
> // 2. Perform a hash-table lookup on globalThis
> // 3. Walk the prototype chain to resolve the constructor
> // 4. Allocate a transient jsi::Function wrapper on the C++ stack
> Object bufferObject = rt.global()
>     .getPropertyAsFunction(rt, "ArrayBuffer")   // Lookup 1: String reflection
>     .callAsConstructor(rt, static_cast<double>(byteCount))
>     .asObject(rt);
>
> return rt.global()
>     .getPropertyAsFunction(rt, "Float32Array")  // Lookup 2: String reflection
>     .callAsConstructor(rt, bufferObject);
> ```
>
> At 60 FPS across 3 buffer queries (`getBalls`, `getBricks`, `getPowerUps`), this executes **360 string lookups every second** (720 lookups/sec at 120 FPS).
>
> Below is the complete step-by-step production implementation to eliminate 100% of runtime string lookups by caching the constructor functions once at startup.
>
> ---
>
> ### Architecture Overview: Where and Why
>
> | Location | File | Purpose |
> | :--- | :--- | :--- |
> | **Initialization** | `shared/NativeRustModule.cpp` | Cache `ArrayBuffer` and `Float32Array` constructors once inside `install()` |
> | **Hot Loop Lambda** | `shared/NativeRustModule.cpp` | Capture the cached constructors in the HostFunction closure (`getValues`, `getBalls`, etc.) |
> | **Avoid Header Members** | `shared/NativeRustModule.h` | Do not store as class members (avoids UAF and runtime teardown crashes) |
>
> ---
>
> ### Step 1: Cache Constructor References Once during `install()`
>
> **Target File:** `shared/NativeRustModule.cpp`  
> **Location:** Inside `NativeRustModule::install(Runtime& runtime)`, right before registering any typed array getter methods.
>
> ```cpp
> // =============================================================================
> // STEP 1: RESOLVE AND CACHE CONSTRUCTORS ONCE AT STARTUP
> // =============================================================================
> // Required headers:
> //   #include <memory>        // For std::make_shared, std::shared_ptr
> //   #include <jsi/jsi.h>     // For facebook::jsi::Function, Runtime, Object
> //
> // Why std::shared_ptr<jsi::Function>?
> //   HostFunctions registered with JSI are C++ lambdas that outlive the install()
> //   stack frame. Wrapping the jsi::Function in a std::shared_ptr allows multiple
> //   HostFunction lambdas (e.g. getBalls, getBricks, getPowerUps) to share ownership
> //   safely without lifetime races or dangling pointers when the JSI runtime shuts down.
> // =============================================================================
>
> void NativeRustModule::install(Runtime& runtime) {
>   Object api(runtime);
>
>   // 1. Resolve the global ArrayBuffer constructor once from the JavaScript global scope:
>   auto arrayBufferCtor = std::make_shared<Function>(
>       runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer"));
>
>   // 2. Resolve the global Float32Array view constructor once from the JavaScript global scope:
>   auto float32ArrayCtor = std::make_shared<Function>(
>       runtime.global().getPropertyAsFunction(runtime, "Float32Array"));
>
>   // Constructors are now safely cached. Proceed to register methods below...
> ```
>
> ---
>
> ### Step 2: Capture Cached Constructors in Your Buffer Getter HostFunctions
>
> **Target File:** `shared/NativeRustModule.cpp`  
> **Location:** Inside the lambda of any method returning raw typed buffer data (e.g. `getValues`, `getBalls`, `getBricks`).
>
> ```cpp
>   // =============================================================================
>   // STEP 2: CAPTURE CACHED CONSTRUCTORS IN HOSTFUNCTION LAMBDA
>   // =============================================================================
>   // Notice the lambda capture list:
>   //   [data = this->data_, arrayBufferCtor, float32ArrayCtor]
>   //
>   // Capturing by value increments the shared_ptr reference count. When the JS
>   // garbage collector eventually disposes of the HostFunction during app reload,
>   // the shared_ptr automatically releases the cached jsi::Function.
>   // =============================================================================
>   api.setProperty(
>       runtime,
>       "getValues",
>       Function::createFromHostFunction(
>           runtime,
>           PropNameID::forAscii(runtime, "getValues"),
>           0, // Parameter count: 0 arguments expected
>           [data = this->data_, arrayBufferCtor, float32ArrayCtor](
>               Runtime& rt, const Value& thisValue, const Value* args, std::size_t count) -> Value {
>             // Guard check: ensure underlying Rust engine instance is valid
>             if (!data) {
>               return Value::null();
>             }
>             if (count != 0) {
>               throw JSError(rt, "getValues() does not accept arguments");
>             }
>
>             // -----------------------------------------------------------------
>             // 1. QUERY RUST MEMORY SLICE VIA C-ABI FFI
>             // -----------------------------------------------------------------
>             // rust_data_values returns a const float* pointing directly into Rust
>             // contiguous heap memory (e.g. Vec<f32>) and populates length.
>             std::size_t length = 0;
>             const float* source = rust_data_values(data.get(), &length);
>             if (source == nullptr || length == 0) {
>               return Value::null();
>             }
>
>             // Total bytes to copy: float count * 4 bytes per IEEE 754 float
>             const std::size_t byteCount = length * sizeof(float);
>
>             // -----------------------------------------------------------------
>             // 2. ALLOCATE ARRAYBUFFER ON HERMES/V8 HEAP (ZERO STRING LOOKUPS)
>             // -----------------------------------------------------------------
>             // Instead of rt.global().getPropertyAsFunction(rt, "ArrayBuffer"),
>             // invoke the pre-cached constructor directly:
>             Object bufferObject = arrayBufferCtor
>                 ->callAsConstructor(rt, static_cast<double>(byteCount))
>                 .asObject(rt);
>
>             // -----------------------------------------------------------------
>             // 3. COPY BYTES DIRECTLY INTO JSI MANAGED BUFFER
>             // -----------------------------------------------------------------
>             // getArrayBuffer(rt) gives direct access to the JS buffer memory.
>             // std::memcpy performs a high-speed synchronous CPU memory block copy.
>             ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
>             std::memcpy(buffer.data(rt), source, byteCount);
>
>             // -----------------------------------------------------------------
>             // 4. INSTANTIATE FLOAT32ARRAY VIEW DIRECTLY (ZERO STRING LOOKUPS)
>             // -----------------------------------------------------------------
>             // Wrap the ArrayBuffer in a Float32Array typed array view and return to JS:
>             return float32ArrayCtor->callAsConstructor(rt, bufferObject);
>           }));
> ```
>
> ---
>
> ### Step 3: Why Storing Constructors as Class Members with `[this]` is an Anti-Pattern (UAF & Lifecycle Hazards)
>
> A common instinct when structuring C++ classes is to store cached constructor handles as class member variables:
>
> ```cpp
> // DANGEROUS ANTI-PATTERN (DO NOT USE IN TURBOMODULES):
> class NativeRustModule : public NativeRustModuleCxxSpec<NativeRustModule> {
>  private:
>   // Storing JSI constructor handles as module members:
>   std::unique_ptr<facebook::jsi::Function> arrayBufferCtor_{nullptr};
>   std::unique_ptr<facebook::jsi::Function> float32ArrayCtor_{nullptr};
> };
> ```
> And capturing `[this]` inside HostFunction lambdas:
> ```cpp
> // DANGEROUS HOSTFUNCTION CLOSURE:
> [this](Runtime& rt, const Value&, const Value*, std::size_t) -> Value {
>   Object bufferObject = this->arrayBufferCtor_
>       ->callAsConstructor(rt, static_cast<double>(byteCount))
>       .asObject(rt);
>   ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
>   std::memcpy(buffer.data(rt), source, byteCount);
>   return this->float32ArrayCtor_->callAsConstructor(rt, bufferObject);
> }
> ```
>
> > [!CAUTION]
> > **Critical Safety Warning: Use-After-Free (UAF) and Runtime Crash Hazards**
> >
> > Storing `jsi::Function` as class members and capturing `[this]` introduces two severe memory and lifecycle hazards:
> >
> > 1. **Use-After-Free (Dangling `this` Pointer):**
> >    In React Native, TurboModules are owned by the native C++ module registry, whereas registered HostFunctions are JavaScript function objects owned and retained by the JavaScript runtime (`globalThis`). A JavaScript HostFunction can easily outlive the C++ `NativeRustModule` instance (for example, during Fast Refresh, runtime reloads, bridge invalidation, or navigation state transitions). If JavaScript invokes the HostFunction after the C++ instance has been destructed, accessing `this->arrayBufferCtor_` dereferences a dangling pointer, leading to an immediate crash or heap corruption.
> >
> > 2. **JSI Runtime Invalidation Race (`SIGSEGV`):**
> >    Every JSI handle (`jsi::Function`, `jsi::Object`, `jsi::Value`) is explicitly bound to a specific `jsi::Runtime` instance. If `NativeRustModule` holds `std::unique_ptr<jsi::Function>` members, their C++ destructors attempt to notify the runtime to clean up handles. If the `jsi::Runtime` is destroyed before the TurboModule C++ destructor executes, destructing `arrayBufferCtor_` calls into an already-freed `Runtime`, causing a fatal segmentation fault (`SIGSEGV`).
> >
> > **The Safe Architecture (Step 1 & Step 2):**
> > Always use the closure-based shared pointer pattern demonstrated in Steps 1 and 2:
> > ```cpp
> > [data = this->data_, arrayBufferCtor, float32ArrayCtor](Runtime& rt, ...) -> Value
> > ```
> > Capturing `std::shared_ptr<jsi::Function>` by value directly into the HostFunction closure binds the constructors' lifetime directly to the HostFunction inside the JavaScript engine. When the runtime shuts down or when JavaScript garbage collects the HostFunction, the closure and its captured constructors are safely destroyed within the valid lifecycle of the runtime, preventing both UAF and runtime teardown crashes.
>
> ---
>
> ### High-Frequency Performance Best Practice: Event-Driven Bitmask Polling
>
> While caching typed array constructors eliminates string reflection overhead, polling large entity buffers (e.g., 20–50 game entities or world layout blocks) on every 60/120 FPS frame still causes JavaScript heap churn when converting native buffer floats into UI objects.
>
> **The Solution: Pair JSI TypedArrays with a Read-and-Clear Event Bitmask**
>
> #### 1. Rust Bitmask Definition & Read-and-Clear Lifecycle Contract:
> In Rust (`rust-core/src/game.rs` / `rust-core/src/lib.rs`), define bit flags and implement a **Read-and-Clear contract** inside `get_events()`:
> ```rust
> pub const EVENT_NONE: u32 = 0;
> pub const EVENT_PADDLE_HIT: u32 = 1 << 0;
> pub const EVENT_BRICK_HIT: u32 = 1 << 1;
> pub const EVENT_BRICK_DESTROY: u32 = 1 << 2;
> pub const EVENT_LAYOUT_CHANGED: u32 = 1 << 3;
>
> // Lifecycle Contract: Reads and clears the flags under exclusive mutable access (&mut self)
> // so events trigger exactly once per frame.
> // Note: If events can be written from another thread (e.g. background worker or audio thread),
> // use thread-safe synchronization such as std::sync::atomic::AtomicU32::swap(0, Ordering::AcqRel).
> pub fn get_events(&mut self) -> u32 {
>     let current_events = self.events;
>     self.events = EVENT_NONE; // Cleared on read under exclusive mutable access
>     current_events
> }
> ```
>
> > [!NOTE]
> > **Integration Scope Note:**
> > The event bitmask pattern requires its own C ABI export (`rust_game_get_events`), C++ JSI binding (`api.setProperty(runtime, "getEvents", ...)`), and TypeScript API declaration. These additions are domain-specific optimizations demonstrated in the `BrickBreaker` project (`rust-core/src/game.rs`, `shared/NativeRustModule.cpp`, `src/RustModule.ts`) and are not part of the basic generic `RustModule` bridge illustrated earlier in Sections 4 through 8.
>
> #### 2. TypeScript Constants Mapping:
> In TypeScript (`src/RustModule.ts`), mirror the Rust bitmask values:
> ```ts
> export const RUST_EVENT = {
>   PADDLE_HIT: 1 << 0,
>   BRICK_HIT: 1 << 1,
>   BRICK_DESTROY: 1 << 2,
>   LAYOUT_CHANGED: 1 << 3,
> } as const;
> ```
>
> #### 3. Event-Driven Buffer Invalidation in Render Loop:
> In the React / TypeScript render loop (`useGamePhysics.ts`), read the bitmask once per frame and only query the typed array buffer when mutation flags are set or on initial load:
> ```ts
> const events = engine.getEvents(); // Returns accumulated flags and clears native register
> const hasMutation = (events & (RUST_EVENT.BRICK_HIT | RUST_EVENT.BRICK_DESTROY | RUST_EVENT.LAYOUT_CHANGED)) !== 0;
>
> if (hasMutation || !initialLayoutLoaded) {
>   initialLayoutLoaded = true;
>   const bricksData = engine.getBricks(); // TypedArray getter called conditionally
>   // Parse buffer into state only when state actually changed
> }
> ```
> This prevents persistent flags from causing repeated polling on subsequent frames and eliminates redundant object allocations during high-frequency simulation loops.
>
> ---
>
> ### Verification & Performance Guarantees
>
> | Metric | Unoptimized Reflection | Cached Constructor Pattern |
> | :--- | :--- | :--- |
> | **String Hashing Lookups** | 360 to 720 lookups / sec | **0 lookups / sec (100% eliminated)** |
> | **Memory Ownership** | JS owns ArrayBuffer | **JS owns ArrayBuffer** (no shared raw pointers across threads) |

---

## 9. Unified TypeScript Wrapper — `src/RustModule.ts`

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
  var RustModule: RustModuleApi | undefined;
}

// Calls C++ TurboModule install() method to bind HostFunctions to globalThis
NativeRustModule.install();

const moduleInstance = globalThis.RustModule;
if (!moduleInstance) {
  throw new Error(
    'RustModule installation failed. Check Codegen and native module registration.',
  );
}

export const RustModule: RustModuleApi = moduleInstance;
export default RustModule;
```

---

## 10. Platform Native Build Integration (OS-Specific)

### 🤖 10.1 Android: CMake & Gradle Setup

#### `android/app/src/main/jni/CMakeLists.txt`:
```cmake
cmake_minimum_required(VERSION 3.13)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Compile integration C++ file into native target
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../shared/NativeRustModule.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../shared
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../rust-core/include
)

# Map Android ABI to Rust target triple
if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(RUST_TARGET "aarch64-linux-android")
elseif(ANDROID_ABI STREQUAL "x86_64")
    set(RUST_TARGET "x86_64-linux-android")
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
    set(RUST_TARGET "armv7-linux-androideabi")
elseif(ANDROID_ABI STREQUAL "x86")
    set(RUST_TARGET "i686-linux-android")
else()
    message(FATAL_ERROR "Unsupported Android ABI: ${ANDROID_ABI}")
endif()

set(RUST_CORE_ARCHIVE
    "${CMAKE_CURRENT_LIST_DIR}/../../../../../rust-core/target/${RUST_TARGET}/release/librust_core.a"
)

# Note: Use WARNING rather than FATAL_ERROR so preliminary CMake evaluation passes during
# initial Gradle sync on a fresh checkout before the buildRust task has executed.
if(NOT EXISTS "${RUST_CORE_ARCHIVE}")
    message(WARNING "Rust archive not found at: ${RUST_CORE_ARCHIVE}. Ensure cargo ndk build has run.")
endif()

add_library(rust_core STATIC IMPORTED GLOBAL)
set_target_properties(rust_core PROPERTIES
    IMPORTED_LOCATION "${RUST_CORE_ARCHIVE}"
)

target_link_libraries(${CMAKE_PROJECT_NAME} rust_core)
```

#### `android/app/build.gradle`:
Inside `android { ... }`:
```groovy
android {
    externalNativeBuild {
        cmake {
            path "src/main/jni/CMakeLists.txt"
        }
    }
}
```

At the bottom of `android/app/build.gradle`, add the automatic Rust compilation task:
```groovy
def targetArchitectures = (
    project.findProperty("reactNativeArchitectures") ?: "arm64-v8a,x86_64,armeabi-v7a,x86"
).split(",")

tasks.register("buildRust", Exec) {
    description = "Compiles the Rust static library via cargo-ndk"
    workingDir file("${rootDir}/../rust-core")

    // Cross-platform Cargo & NDK environment injection (Windows, macOS, Linux):
    def userHome = System.getProperty("user.home") ?: System.getenv("HOME") ?: System.getenv("USERPROFILE")
    def cargoBin = new File(userHome, ".cargo/bin").absolutePath
    def currentPath = System.getenv("PATH") ?: ""
    environment "PATH", "${cargoBin}${File.pathSeparator}${currentPath}"
    if (android.hasProperty("ndkDirectory") && android.ndkDirectory != null) {
        environment "ANDROID_NDK_HOME", android.ndkDirectory.absolutePath
        environment "NDK_HOME", android.ndkDirectory.absolutePath
    }

    def cargoArgs = ["cargo", "ndk"]
    targetArchitectures.each { arch ->
        def trimmed = arch.trim()
        if (!trimmed.isEmpty()) {
            cargoArgs.addAll(["-t", trimmed])
        }
    }
    cargoArgs.addAll(["build", "--release"])

    if (org.gradle.internal.os.OperatingSystem.current().isWindows()) {
        commandLine(["cmd", "/c"] + cargoArgs)
    } else {
        commandLine(cargoArgs)
    }
}

tasks.configureEach { task ->
    if (task.name.startsWith("configureCMake") ||
        task.name.startsWith("externalNativeBuild")) {
        task.dependsOn("buildRust")
    }
}

preBuild.dependsOn("buildRust")
```

#### `android/gradle.properties`:
Add the following flags to ensure compatibility with modern Android Gradle Plugin (AGP 9+):
```properties
# Opt out of built-in Kotlin and new DSL behavior in AGP 9.x to preserve React Native variant APIs:
android.builtInKotlin=false
android.newDsl=false
```
> [!NOTE]
> AGP 9.0+ deprecates legacy variant APIs (`applicationVariants`, `testVariants`). Setting `android.newDsl=false` and `android.builtInKotlin=false` ensures compatibility with React Native 0.88 build tooling and prevents configuration-time failures.

---

### 🍎 10.2 iOS: CocoaPods & Podspec Setup

#### `RustModule.podspec` (at project root):
```ruby
require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name            = "RustModule"
  s.version         = package["version"]
  s.summary         = "Rust integration for React Native via C++ TurboModule"
  s.license         = "MIT"
  s.author          = { "Developer" => "dev@example.com" }
  s.homepage        = "https://github.com/example/react-native-rust-integration"
  s.platforms       = { :ios => "15.1" }
  s.source          = { :git => "https://github.com/example/react-native-rust-integration.git", :tag => "v#{s.version}" }

  # Compile cross-platform C++
  s.source_files    = "shared/**/*.{h,cpp}"
  s.public_header_files = "shared/**/*.h"

  # Vendor the pre-packaged XCFramework
  s.vendored_frameworks = "rust-core/target/RustCore.xcframework"

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "HEADER_SEARCH_PATHS" => "\"$(inherited)\" \"$(PODS_TARGET_SRCROOT)/shared\" \"$(PODS_TARGET_SRCROOT)/rust-core/include\""
  }

  install_modules_dependencies(s)
end
```

> **Podspec Metadata Note:**
> `s.source` requires a valid repository URL and tag for CocoaPods spec validation and distribution. During local development, the `:path => '../'` dependency in `Podfile` directs CocoaPods to compile your local workspace checkout, but maintaining a valid `s.source` URL ensures the podspec remains compliant with CocoaPods syntax standards.

#### `ios/Podfile`:
Treat this as an addition to your project's existing standard React Native Podfile template. Do not replace the entire file—simply add `pod 'RustModule', :path => '../'` inside the target block while preserving all standard React Native setup calls (`prepare_react_native_project!`, `use_frameworks!`, `use_react_native!`, and `post_install`):

```ruby
# Resolve react_native_pods.rb with node to allow for hoisting
require Pod::Executable.execute_command('node', ['-p',
  'require.resolve(
    "react-native/scripts/react_native_pods.rb",
    {paths: [process.argv[1]]},
  )', __dir__]).strip

platform :ios, min_ios_version_supported
prepare_react_native_project!

linkage = ENV['USE_FRAMEWORKS']
if linkage != nil
  Pod::UI.puts "Configuring Pod with #{linkage}ally linked Frameworks".green
  use_frameworks! :linkage => linkage.to_sym
end

target 'BrickBreaker' do # Replace 'BrickBreaker' with your iOS target name (<YourProjectName>)
  config = use_native_modules!

  # Include the Rust C++ TurboModule local pod
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

    # Automatically ensure RustModuleProvider.mm is in Xcode's BrickBreaker compile sources
    # (Replace 'BrickBreaker' with your Xcode project/target name: <YourProjectName>)
    require 'xcodeproj'
    project_path = "#{Pod::Config.instance.installation_root}/BrickBreaker.xcodeproj"
    project = Xcodeproj::Project.open(project_path)
    target = project.targets.find { |t| t.name == 'BrickBreaker' }
    group = project.main_group.find_subpath('BrickBreaker')

    if target && group
      source_files = ['RustModuleProvider.h', 'RustModuleProvider.mm']
      changed = false

      source_files.each do |file_name|
        file_ref = group.find_file_by_path(file_name) || group.new_file(file_name)
        if file_name.end_with?('.mm') && !target.source_build_phase.files_references.include?(file_ref)
          target.add_file_references([file_ref])
          changed = true
        end
      end

      if changed
        project.save
        Pod::UI.puts "[RustModule] Automatically added RustModuleProvider.mm to Xcode BrickBreaker target".green
      end
    else
      Pod::UI.warn "[RustModule] Could not locate BrickBreaker target or group in #{project_path}"
    end
  end
end
```

---

## 11. TurboModule Registration (OS-Specific)

### 🤖 11.1 Android Registration (`OnLoad.cpp`)
In `android/app/src/main/jni/OnLoad.cpp`, include `NativeRustModule.h` and add the provider branch inside `cxxModuleProvider`:

```cpp
#include <NativeRustModule.h>

std::shared_ptr<TurboModule> cxxModuleProvider(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  if (name == NativeRustModule::kModuleName) {
    return std::make_shared<NativeRustModule>(jsInvoker);
  }

  return autolinking_cxxModuleProvider(name, jsInvoker);
}
```

---

### 🍎 11.2 iOS Registration (`RustModuleProvider`)
Create `ios/BrickBreaker/RustModuleProvider.h` and `ios/BrickBreaker/RustModuleProvider.mm` (or `ios/<YourProjectName>/...`):

#### `ios/BrickBreaker/RustModuleProvider.h`:
```objc
#import <Foundation/Foundation.h>
#import <ReactCommon/RCTTurboModule.h>

NS_ASSUME_NONNULL_BEGIN

@interface RustModuleProvider : NSObject <RCTModuleProvider>
@end

NS_ASSUME_NONNULL_END
```

#### `ios/BrickBreaker/RustModuleProvider.mm`:
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

> [!TIP]
> **AUTOMATIC XCODE REGISTRATION:**
> The `post_install` hook in `ios/Podfile` automatically adds `RustModuleProvider.mm` to Xcode's app target compile sources whenever `pod install` runs using CocoaPods' built-in `xcodeproj` library. No manual drag-and-drop or project editing is required.

---

## 12. Build and Run Commands

### 🤖 Android
```bash
# 1. Build Rust static libraries
cd rust-core && ./build-android.sh && cd ..

# 2. Run Android app (or let Gradle's buildRust task compile automatically)
npx react-native run-android
```

### 🍎 iOS
```bash
# 1. Build Rust XCFramework
cd rust-core && ./build-ios.sh && cd ..

# 2. Install CocoaPods and generate Codegen specs
cd ios && pod install && cd ..

# 3. Run iOS app
npx react-native run-ios --simulator "iPhone 16"
```

> [!NOTE]
> **Troubleshooting: DerivedData Permission Error (NSCocoaErrorDomain Code 513)**
> If you encounter:
> ```text
> Error Domain=NSCocoaErrorDomain Code=513 "You don't have permission to save the file 'DerivedData' in the folder 'Xcode'."
> ```
> This occurs when executing in sandboxed developer environments, CI/CD runners, or restricted user accounts where write permissions to the global directory `~/Library/Developer/Xcode/DerivedData` are prohibited.
>
> **Mitigation**:
> Redirect DerivedData into a local directory inside the workspace using the `-derivedDataPath` flag:
> ```bash
> xcodebuild -workspace ios/BrickBreaker.xcworkspace \
>   -scheme BrickBreaker \
>   -configuration Debug \
>   -destination 'platform=iOS Simulator,name=iPhone 16' \
>   -derivedDataPath ./build/DerivedData build
> ```
> You can then install and launch the compiled bundle on the booted simulator without needing global filesystem permissions:
> ```bash
> xcrun simctl install booted ./build/DerivedData/Build/Products/Debug-iphonesimulator/BrickBreaker.app
> xcrun simctl launch booted org.reactjs.native.example.BrickBreaker
> ```

---

## 13. Adding More Functions (1-Line Workflow)

To expose a new function (e.g. `subtract`):

1. **Export from Rust** (`rust-core/src/lib.rs`):
   ```rust
   #[unsafe(no_mangle)]
   pub extern "C" fn rust_subtract(a: f64, b: f64) -> f64 {
       a - b
   }
   ```
2. **Rebuild Rust** (`cargo ndk` for Android, `./build-ios.sh` for iOS).
3. **Register in C++** (`shared/NativeRustModule.cpp` inside `install`):
   ```cpp
   bind(runtime, api, "subtract", rust_subtract);
   ```
4. **Add to TypeScript** (`src/RustModule.ts`):
   ```ts
   export interface RustModuleApi {
     // ...
     subtract(a: number, b: number): number;
   }
   ```
5. **Call from JS:**
   ```ts
   const result = RustModule.subtract(10, 4); // 6
   ```

No manual JNI, Java, Kotlin, Swift, or Objective-C glue code is required for supported function signatures.
