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

## 2. Prerequisites & Target Setup

### Common Tools (Both Platforms)
* Node.js (>= 18 / 20 / 22) and package manager (`yarn`, `npm`, or `pnpm`)
* Rust installed via `rustup` (`rustc --version`, `cargo --version`)
* A working **bare React Native** project (**React Native 0.79.x**, New Architecture enabled)

> **React Native Version Scope Note:**
> The TurboModule bootstrap and native Codegen configuration in this guide are strictly scoped to **React Native 0.79.x**.
>
> While the Rust C ABI and C++ generic JSI binder remain identical across React Native releases, native module registration and Codegen schemas differ across versions:
> - **RN 0.79.x Flat Schema (Used in this guide):**
>   `"ios": { "modulesProvider": { "NativeRustModule": "RustModuleProvider" } }`
> - **RN 0.80+ / Current Codegen Documentation (Nested Schema):**
>   `"ios": { "modules": { "NativeRustModule": { "className": "RustModuleProvider" } } }`
>
> If you are targeting another release, inspect your installed `@react-native/codegen` package's schema and official documentation rather than assuming universal cross-version compatibility for the native registration files.

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
* macOS with Xcode (15+ or 16+) and Command Line Tools (`xcode-select --install`)
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
MyReactNativeApp/
├── android/
│   ├── gradle.properties
│   └── app/
│       ├── build.gradle               # [Android] Invokes cargo-ndk before CMake
│       └── src/main/jni/
│           ├── CMakeLists.txt         # [Android] Compiles shared/ and links librust_core.a
│           └── OnLoad.cpp             # [Android] Registers NativeRustModule
├── ios/
│   ├── Podfile                        # [iOS] Links local RustModule pod
│   └── GamePrototype/
│       ├── RustModuleProvider.h       # [iOS] TurboModule provider interface
│       └── RustModuleProvider.mm      # [iOS] Objective-C++ provider class
├── rust-core/
│   ├── Cargo.toml                     # Rust 2024 edition, panic = "abort"
│   ├── cbindgen.toml                  # C bindings config
│   ├── build.rs                       # Auto-generates rust_core.h
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

### 🤖 5.1 Android Build (`cargo-ndk`)
Run from project root:
```bash
cd rust-core
cargo ndk -t arm64-v8a -t x86_64 -t armeabi-v7a -t x86 build --release
cd ..
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

```json
{
  "name": "GamePrototype",
  "version": "0.0.1",
  "scripts": {
    "build:rust": "cd rust-core && ./build-ios.sh",
    "ios": "npm run build:rust && react-native run-ios",
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
      "modulesProvider": {
        "NativeRustModule": "RustModuleProvider"
      }
    }
  }
}
```

> **Codegen Schema Variance Across Releases:**
> - **Flat `modulesProvider` (RN 0.79.x standard used here):**
>   ```json
>   "ios": { "modulesProvider": { "NativeRustModule": "RustModuleProvider" } }
>   ```
> - **Nested `modules` (RN 0.80+ / current Codegen docs):**
>   ```json
>   "ios": { "modules": { "NativeRustModule": { "className": "RustModuleProvider" } } }
>   ```
> When building on versions other than 0.79.x, check which schema structure your installed version of `@react-native/codegen` expects.

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

if(NOT EXISTS "${RUST_CORE_ARCHIVE}")
    message(FATAL_ERROR "Rust archive not found: ${RUST_CORE_ARCHIVE}")
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

target 'GamePrototype' do
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

    # Automatically ensure RustModuleProvider.mm is in Xcode's GamePrototype compile sources
    require 'xcodeproj'
    project_path = "#{Pod::Config.instance.installation_root}/GamePrototype.xcodeproj"
    project = Xcodeproj::Project.open(project_path)
    target = project.targets.find { |t| t.name == 'GamePrototype' }
    group = project.main_group.find_subpath('GamePrototype')

    source_files = ['RustModuleProvider.h', 'RustModuleProvider.mm']
    changed = false

    source_files.each do |file_name|
      rel_path = "GamePrototype/#{file_name}"
      file_ref = group.find_file_by_path(rel_path) || group.new_file(rel_path)
      if file_name.end_with?('.mm') && !target.source_build_phase.files_references.include?(file_ref)
        target.add_file_references([file_ref])
        changed = true
      end
    end

    if changed
      project.save
      Pod::UI.puts "[RustModule] Automatically added RustModuleProvider.mm to Xcode GamePrototype target".green
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
Create `ios/GamePrototype/RustModuleProvider.h` and `ios/GamePrototype/RustModuleProvider.mm`:

#### `ios/GamePrototype/RustModuleProvider.h`:
```objc
#import <Foundation/Foundation.h>
#import <ReactCommon/RCTTurboModule.h>

NS_ASSUME_NONNULL_BEGIN

@interface RustModuleProvider : NSObject <RCTModuleProvider>
@end

NS_ASSUME_NONNULL_END
```

#### `ios/GamePrototype/RustModuleProvider.mm`:
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
# 1. Build Rust
cd rust-core && cargo ndk -t arm64-v8a -t x86_64 -t armeabi-v7a -t x86 build --release && cd ..

# 2. Run Android app
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
