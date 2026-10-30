# React Native + Rust Integration — Complete Android Guide

This guide shows how to expose Rust functions to a bare React Native Android app through a Rust static library, C++17, JSI, and a C++ TurboModule.

It uses generic examples (`add`, `multiply`, `greeting`, and a small numeric data store). It contains the actual `.h` and `.cpp` files and the Android build/configuration steps.

> **Version note:** The TurboModule/Codegen bootstrap follows the React Native 0.79 C++ TurboModule structure. Native CMake files and generated Codegen headers are version-sensitive. If you use another React Native version, keep the same Rust/C ABI concepts but compare the native registration steps with that version's official C++ TurboModule guide. Do not replace your existing `OnLoad.cpp` with a file copied from a different RN version.

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
Rust static library
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
| JSI | Allows native C++ HostFunctions to be called from JavaScript |
| C++17 | Generic binder and native integration |
| Rust | Implements the native functions and owns Rust-side data |
| C ABI / FFI | Boundary between Rust and C++ |
| Cargo + `cargo-ndk` | Builds Rust for Android ABIs |
| `cbindgen` | Generates the C header for Rust exports |
| CMake + Android NDK | Compiles C++ and links the Rust archive |
| Gradle + Codegen | Coordinates native build and TurboModule registration |

---

## 2. Prerequisites

You need:

- A working **bare React Native** Android project.
- Node.js and the package manager used by that project.
- JDK and Android SDK versions already supported by your RN project.
- Android NDK and CMake installed through Android Studio's SDK Manager.
- Rust installed with `rustup`.
- An Android emulator or physical device.

Verify the tools:

```bash
node --version
java -version
rustc --version
cargo --version
```

Install `cargo-ndk`:

```bash
cargo install cargo-ndk
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

In `android/gradle.properties`, verify settings appropriate for your RN version. In a New Architecture project this commonly includes:

```properties
newArchEnabled=true
hermesEnabled=true
```

Do not upgrade RN, Gradle, NDK, or CMake just for this guide. First use the versions that already build your app.

---

## 3. Create the folder structure

All paths are relative to the React Native project root:

```text
MyReactNativeApp/
├── android/
│   ├── gradle.properties
│   └── app/
│       ├── build.gradle
│       └── src/main/jni/
│           ├── CMakeLists.txt
│           └── OnLoad.cpp
├── rust-core/
│   ├── Cargo.toml
│   ├── cbindgen.toml
│   ├── build.rs
│   ├── include/                       # Generated: rust_core.h
│   └── src/
│       └── lib.rs
├── shared/
│   ├── NativeRustModule.h
│   └── NativeRustModule.cpp
├── specs/
│   └── NativeRustModule.ts
├── src/
│   └── RustModule.ts
├── App.tsx
└── package.json
```

Create the directories from the project root:

```bash
mkdir -p rust-core/src rust-core/include shared specs src
mkdir -p android/app/src/main/jni
```

**Important:** If your RN project already has `android/app/src/main/jni/CMakeLists.txt` or `OnLoad.cpp`, back them up and merge the required changes. They are part of React Native's native startup and must match your installed RN version.

---

## 4. Rust library

**Recommended:** Just use `cargo new rust-core --lib` instead of the copy pase of the cargo toml file.
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

The package name is `rust-core`; the native archive name is `librust_core.a`. The explicit `staticlib` output is what CMake links.

### 4.2 `rust-core/cbindgen.toml`

```toml
language = "C"
cpp_compat = true
include_guard = "RUST_CORE_H"
autogen_warning = "/* Generated by cbindgen. Do not edit manually. */"
```

`cpp_compat = true` makes the generated declarations usable from C++ with C linkage guards.

### 4.3 `rust-core/build.rs`

```rust
use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR")
            .expect("CARGO_MANIFEST_DIR is not set"),
    );

    // Derive the header filename from Cargo.toml's package name.
    // For example, "rust-core" becomes "rust_core.h".
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

This creates the include directory if necessary and generates a header based on the Cargo package name. For the `name = "rust-core"` package shown in `Cargo.toml`, the result is `rust-core/include/rust_core.h`. If you rename the package, the header filename changes with it; update the matching C++ include and CMake include path if you change the package/library naming. Change Rust declarations, not the generated header.

### 4.4 `rust-core/src/lib.rs`

This example exposes scalar functions, a Rust-owned string, and optional state with a numeric buffer.

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

/// Takes a NUL-terminated UTF-8-compatible C string and returns a newly
/// allocated C string. The caller must release the returned pointer with
/// rust_string_free().
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

/// Releases a string returned by rust_greeting().
///
/// # Safety
/// `value` must be null or a pointer returned by rust_greeting(), and it must
/// not have been freed already.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_string_free(value: *mut c_char) {
    if !value.is_null() {
        drop(unsafe { CString::from_raw(value) });
    }
}

// ---------- Optional stateful example ----------

pub struct RustData {
    values: Vec<f32>,
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_data_create(value_count: usize) -> *mut RustData {
    Box::into_raw(Box::new(RustData {
        values: vec![0.0; value_count],
    }))
}

/// Returns true when the index exists; otherwise returns false.
///
/// # Safety
/// `data` must be null or point to a live RustData created by rust_data_create().
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

/// Returns a borrowed pointer to Rust-owned memory and writes its element count.
/// The pointer is valid only while `data` remains alive and the vector is not
/// mutated in a way that reallocates it. The C++ example copies it immediately.
///
/// # Safety
/// `data` must be null or point to a live RustData. `out_len` must be null or
/// point to writable memory for one usize.
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

/// Destroys a data instance.
///
/// # Safety
/// `data` must be null or a live pointer returned by rust_data_create(), and
/// must not be used or destroyed again after this call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn rust_data_destroy(data: *mut RustData) {
    if !data.is_null() {
        drop(unsafe { Box::from_raw(data) });
    }
}
```

### Rust ownership rules

- Rust owns the `CString` returned by `rust_greeting` until C++ copies it into a JavaScript string and calls `rust_string_free`.
- Rust owns each `RustData` allocation. C++ stores only its opaque pointer and must call `rust_data_destroy` exactly once.
- `rust_data_values` returns a borrowed pointer. Do not keep it after destroying the owner or after operations that could invalidate the vector's storage.
- Never allow a Rust panic to unwind through the C ABI.

### 4.5 Check the Rust crate

From the project root:

```bash
cd rust-core
cargo check
cd ..
```

This checks the host build only. Continue with Android targets next.

---

## 5. Build Rust for Android

For Android builds, support the target architectures needed by your app (both 64-bit and 32-bit):

| Android ABI | Rust target triple | Note |
|---|---|---|
| `arm64-v8a` | `aarch64-linux-android` | Modern 64-bit ARM devices (standard) |
| `x86_64` | `x86_64-linux-android` | 64-bit Android emulators |
| `armeabi-v7a` | `armv7-linux-androideabi` | Legacy 32-bit ARM devices |
| `x86` | `i686-linux-android` | Legacy 32-bit emulators |

Install all four Rust targets:

```bash
rustup target add aarch64-linux-android x86_64-linux-android armv7-linux-androideabi i686-linux-android
```

Build the static libraries for all targets (or limit to the specific ABIs configured in your project):

```bash
cd rust-core
cargo ndk -t arm64-v8a -t x86_64 -t armeabi-v7a -t x86 build --release
cd ..
```

Expected archives:

```text
rust-core/target/aarch64-linux-android/release/librust_core.a
rust-core/target/x86_64-linux-android/release/librust_core.a
rust-core/target/armv7-linux-androideabi/release/librust_core.a
rust-core/target/i686-linux-android/release/librust_core.a
```

If this fails, fix the Cargo/NDK error before working on C++ or React Native. The archive must match the ABI that CMake is currently building.

---

## 6. React Native Codegen spec

### `specs/NativeRustModule.ts`

```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  install(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRustModule');
```

This TurboModule method provides the JS entry point that causes installation of the HostFunctions. For a C++ TurboModule, React Native supplies the active `jsi::Runtime&` to the C++ method implementation. This differs from writing an ordinary Java/Kotlin native module.

### `package.json`

Merge the following property into your existing `package.json` root object; do not replace the rest of the file:

```json
{
  "codegenConfig": {
    "name": "RustModuleSpecs",
    "type": "modules",
    "jsSrcsDir": "specs",
    "android": {
      "javaPackageName": "com.rustmodule.specs"
    }
  }
}
```

`name` determines the generated Codegen header prefix, used below as `RustModuleSpecsJSI.h`. Codegen spec files must begin with `Native`.

---

## 7. C++ header — `shared/NativeRustModule.h`

This is the header file requested for the integration. It declares the C++ TurboModule and its Rust-owned data pointer.

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
// in iOS app-target translation units (e.g., RustModuleProvider.mm).
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

The `struct RustData;` forward declaration keeps the header fully encapsulated across both Android and iOS without leaking private Rust headers. `std::shared_ptr` provides reload-safe lifetime management.

---

## 8. C++ implementation — `shared/NativeRustModule.cpp`

This file contains the generic C++17 binder, function registration, string conversion, state access, and buffer copying.

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

    // Validate before narrowing the value to prevent undefined behavior
    if (number < minTarget || number > maxTarget) {
      throw JSError(
          runtime,
          "Floating-point argument exceeds the target range");
    }

    return static_cast<U>(number);
  } else if constexpr (std::is_integral_v<U>) {
    if (!value.isNumber()) {
      throw JSError(runtime, "Expected a numeric integer argument");
    }

    const double number = value.asNumber();
    if (!std::isfinite(number) || number != std::trunc(number) ||
        number < static_cast<double>(std::numeric_limits<U>::lowest()) ||
        number > static_cast<double>(std::numeric_limits<U>::max())) {
      throw JSError(runtime, "Integer argument is fractional or out of range");
    }
    return static_cast<U>(number);
  } else {
    static_assert(!sizeof(U), "Unsupported JSI argument type");
  }
}

// Native return -> JS value.
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

  // Hoist shared_ptr copy to local scope once. All HostFunction closures capture
  // 'data' by value, making them completely independent of NativeRustModule's
  // lifetime across Fast Refresh/reload and eliminating the 'this' keyword entirely.
  auto data = data_;

  api.setProperty(
      runtime,
      "setValue",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "setValue"),
          2,
          [data](Runtime& rt, const Value&, const Value* args,
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

  // Stateful getter: copies Rust memory into JS Float32Array (Safe synchronous copy between allocators):
  api.setProperty(
      runtime,
      "getValues",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getValues"),
          0,
          [data](Runtime& rt, const Value&, const Value*,
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

            // This allocates a JS-owned ArrayBuffer and copies the native
            // memory into it. This is intentionally a synchronous COPY between allocators, not raw zero-copy.
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

> [!NOTE]
> For advanced high-frequency simulation patterns demonstrating dynamic re-initialization via the `GameStateHolder` pattern, read-and-clear event bitmask polling, and live entity streaming, see Section 14 in the unified [README.md](README.md#14-reference-application-case-study--brickbreaker-high-performance-game-engine) and the `examples/BrickBreaker` reference application.

### What the binder supports

| C++ function signature type | JavaScript conversion | Notes |
|---|---|---|
| `bool` | Boolean | Checked |
| `float`, `double` | Number | Checked as a number |
| Integral types | Number | Checked for integer and range |
| `void` return | `undefined` | No return conversion |
| `const char*` argument | String | C++ holds UTF-8 storage during the call |
| `char*` return | String or `null` | Must be allocated by the Rust function and freed by `rust_string_free` |
| `const char*` return | String or `null` | Must point to valid, non-owned/borrowed memory for the duration of conversion |
| `std::string` | String | C++ adapter functions only; never return `std::string` directly across Rust's C ABI |

The direct Rust FFI functions in this example use C-compatible types. `std::string` support is for C++ adapter functions that might be registered through the same binder; it is not a Rust ABI type.

### Add another ordinary function

For example, add to `rust-core/src/lib.rs`:

```rust
#[unsafe(no_mangle)]
pub extern "C" fn rust_subtract(a: f64, b: f64) -> f64 {
    a - b
}
```

After rebuilding Rust so the generated header contains `rust_subtract`, register it in `install()`:

```cpp
bind(runtime, api, "subtract", rust_subtract);
```

No new per-function HostFunction wrapper is needed for supported types.

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

// Calls the C++ TurboModule method. The C++ method installs HostFunctions
// onto globalThis using the active JSI runtime passed by the C++ TurboModule.
NativeRustModule.install();

const moduleInstance = globalThis.RustModule;
if (!moduleInstance) {
  throw new Error(
    'RustModule installation failed. Check Codegen, native registration, and OnLoad.cpp.',
  );
}

export const RustModule: RustModuleApi = moduleInstance;
export default RustModule;
```

Import this wrapper before using the global API. For example, in `App.tsx`:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { RustModule } from './src/RustModule';

export default function App() {
  const sum = RustModule.add(20, 22);
  const message = RustModule.greeting('Alex');

  return (
    <View>
      <Text>Sum: {sum}</Text>
      <Text>{message ?? 'No greeting returned'}</Text>
    </View>
  );
}
```

`globalThis.RustModule` is installed by `NativeRustModule.install()`. The TypeScript declaration only gives TypeScript a type; it does not install the object by itself.

> `install()` must only run with a live JSI runtime, which is why it is invoked through the registered C++ TurboModule method rather than by calling the C++ function directly from JavaScript.

---

## 10. Configure Android CMake

### `android/app/src/main/jni/CMakeLists.txt`

This example follows the React Native 0.79 C++ app-module layout. Keep the existing RN CMake setup from your installed package and merge these lines where appropriate.

```cmake
cmake_minimum_required(VERSION 3.13)
project(appmodules)

# Keep this include for the React Native native build.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Compile the integration C++ file into the app's native target.
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../shared/NativeRustModule.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../shared
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../rust-core/include
)

# Match the Rust target triple to the Android ABI CMake is building.
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

**Path check:** `CMAKE_CURRENT_LIST_DIR` points to `android/app/src/main/jni`. Five `..` components return to the project root. If your file lives in a different location, adjust the relative paths.

The `appmodules` project/target name comes from this RN build template. Check the `CMakeLists.txt` for your installed RN version and preserve any existing targets, includes, or libraries instead of replacing them blindly.

---

## 11. Configure Gradle to build Rust first

Open `android/app/build.gradle`. Inside the existing `android { ... }` block, point Gradle to the CMake file:

```groovy
android {
    // Keep the rest of your existing Android configuration.

    externalNativeBuild {
        cmake {
            path "src/main/jni/CMakeLists.txt"
        }
    }
}
```

At the bottom of the same file, add the build task below. This preserves the important behavior of the original implementation: it reads `reactNativeArchitectures` from Gradle, adds one Cargo NDK target per configured ABI, and handles Windows separately.

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

    // Builds target/<rust-target-triple>/release/librust_core.a
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

What the task does:

1. Reads `reactNativeArchitectures` from `android/gradle.properties`. If it is not set, it defaults to `arm64-v8a,x86_64`.
2. Trims each ABI and adds it to the `cargo ndk` command using `-t`.
3. Runs `cargo ndk ... build --release` from the `rust-core` directory.
4. Uses `cmd /c` on Windows and executes Cargo directly on macOS/Linux.
5. Makes the Rust build run before `preBuild` and the matching CMake/native build tasks.

Keep the architecture list in `gradle.properties` as the single source of truth. For example:

```properties
reactNativeArchitectures=arm64-v8a,x86_64,armeabi-v7a,x86
```

If you change that list, Cargo receives the same architectures automatically. Ensure `rust-core` has each corresponding Rust Android target installed and that CMake uses the matching archive for the active `ANDROID_ABI`.

The `externalNativeBuild`/`configureCMake` task names can differ across Android Gradle Plugin and React Native versions, so verify the task names if your build does not honor the dependency. Do not replace the project's existing Gradle build wiring without checking for equivalent dependencies first.

---

## 12. Register the C++ TurboModule

### `OnLoad.cpp`

```
cp node_modules/react-native/ReactAndroid/cmake-utils/default-app-setup/OnLoad.cpp \
   android/app/src/main/jni/OnLoad.cpp
```

This copies React Native's default `OnLoad.cpp` into your project so you can modify it to register `NativeRustModule`.

**Important:** Run this only if the destination file doesn't already exist. Otherwise, back up the existing file first so you don't overwrite your current native configuration.

React Native loads C++ TurboModules through the C++ module provider. Use the `OnLoad.cpp` file shipped with **your installed React Native version**, then add the header and provider branch below. Do not replace the entire file with this partial excerpt; keep all existing React Native bootstrap code.

Add near the other includes:

```cpp
#include <NativeRustModule.h>
```

In the existing `cxxModuleProvider` function, add the branch before the fallback:

```cpp
if (name == NativeRustModule::kModuleName) {
  return std::make_shared<NativeRustModule>(jsInvoker);
}

return autolinking_cxxModuleProvider(name, jsInvoker);
```

Ensure the actual function has the right surrounding signature and only one fallback return. The important pieces are: the include, the name check, and construction with `jsInvoker`.

For reference, the RN 0.79 C++ TurboModule flow is documented in React Native's [Cross-Platform Native Modules (C++) guide](https://reactnative.dev/docs/0.79/the-new-architecture/pure-cxx-modules).

---

## 13. Build and test in stages

From the project root, build Rust for Android first:

```bash
cd rust-core
cargo ndk -t arm64-v8a -t x86_64 -t armeabi-v7a -t x86 build --release
cd ..
```

Run Codegen/build the Android app using your project's package manager. For example:

```bash
npx react-native codegen
npx react-native run-android
```

If your RN version does not expose `npx react-native codegen` as a command, use the Codegen task documented for your version or let the normal Android build invoke Codegen automatically.

Test in JavaScript:

```ts
console.log(RustModule.add(20, 22));            // 42
console.log(RustModule.multiply(6, 7));         // 42
console.log(RustModule.isPositive(5));           // true
console.log(RustModule.greeting('Alex'));        // "Hello, Alex!"
console.log(RustModule.setValue(0, 12.5));       // true
console.log(RustModule.getValues()?.[0]);        // 12.5
```

Test invalid values too:

```ts
RustModule.setValue(5000, 12.5); // false: index is outside the example data array
```

### Verification checklist

- [ ] `cargo check` succeeds.
- [ ] Rust archives build for each ABI you plan to ship.
- [ ] `rust_core.h` is generated.
- [ ] CMake includes both `shared/` and `rust-core/include/`.
- [ ] CMake links the archive matching `ANDROID_ABI`.
- [ ] `NativeRustModule` appears in the Codegen output.
- [ ] `OnLoad.cpp` registers the C++ TurboModule.
- [ ] `RustModule.install()` completes during JS initialization.
- [ ] Scalar function results match expected values.
- [ ] Rust-returned strings are freed exactly once.
- [ ] Rust-owned state is destroyed with the module.
- [ ] App reload and teardown work without stale-pointer crashes.

---

## 14. Memory buffers: what is and isn't zero-copy

`getValues()` above performs these steps:

1. Rust returns a pointer to its `Vec<f32>` data and its length.
2. C++ allocates a JavaScript `ArrayBuffer`.
3. C++ copies the bytes into the JS-owned buffer using `std::memcpy`.
4. C++ creates a JavaScript `Float32Array` over that `ArrayBuffer`.

**This implementation copies the buffer; it is not zero-copy.**

That is deliberate for a beginner-safe example: the returned typed array owns its memory and remains valid even if the Rust data changes or is destroyed. True shared-memory access needs a carefully designed memory ownership, lifetime, and synchronization model. Never expose a raw Rust pointer as though it were already a JavaScript typed array.

Also note that JavaScript numbers are IEEE-754 doubles; integer values larger than \(2^{53}-1\) cannot be represented exactly by a JavaScript `number`. Use a string or an explicit 64-bit representation for large integer IDs/counters.

---

## 15. Common errors

| Error | Likely cause | What to check |
|---|---|---|
| `rust_core.h` not found | Cargo/header generation did not run or include path is wrong | `rust-core/include/` and CMake include paths |
| `librust_core.a` not found | Android archive not built or wrong target path | Target triple, build task order, archive path |
| Undefined `rust_add` symbol | The archive is not linked, the symbol name is wrong, or ABI mismatch | Header declarations, `target_link_libraries`, selected ABI |
| Incompatible binary architecture | Archive and Android ABI differ | `ANDROID_ABI` → Rust target mapping |
| `NativeRustModuleCxxSpec` not found | Codegen name/spec or generated header is wrong | `codegenConfig`, filename prefix `Native`, rerun Codegen |
| `NativeRustModule` is not found in JS | The C++ TurboModule wasn't registered | Check `OnLoad.cpp` provider branch and module name |
| `RustModule` is undefined | `install()` was not called or native installation failed | Import `src/RustModule.ts`, inspect native errors |
| Bad string / native crash | Wrong pointer ownership, missing NUL terminator, or incorrect free function | Only free `rust_greeting` output with `rust_string_free` |
| Crash after reload | Module/runtime or Rust pointer lifetime is mishandled | Destructor, runtime teardown, no repeated frees |
| “Zero-copy” path still allocates | A JS buffer and `memcpy` are used | Treat this sample as a copy |

---

## 16. Performance benchmarking

Do not use a single `Date.now()` measurement to claim Rust is faster than Hermes. Timer resolution, JIT warm-up, optimizer behavior, and background load can skew the result.

For a fair comparison:

1. Run release builds on the same physical device.
2. Warm up both code paths.
3. Repeat many times and compare median and percentile timings.
4. Confirm that both implementations produce the same output.
5. Measure native-call overhead separately from Rust computation.
6. Measure buffer copy time separately if you transfer arrays.
7. Benchmark realistic workloads, not just a trivial loop.

Native code only helps if the work saved is greater than call and data-transfer overhead.

---

## 17. Adding more functions

For a supported stateless Rust function:

1. Export it from `rust-core/src/lib.rs` with `extern "C"` and a supported signature.
2. Rebuild the Rust library so `rust_core.h` updates.
3. Add a single `bind(runtime, api, "jsName", rust_function_name);` line in `NativeRustModule::install`.
4. Add the TypeScript method to `RustModuleApi`.
5. Test the new call on an Android device/emulator.

If a function uses an unsupported signature—such as a struct, slice, raw buffer, or special ownership type—define and document its conversion explicitly. Do not force arbitrary Rust types through the scalar binder.

## Final notes

This guide includes the generic binder and actual `.h`/`.cpp` implementation, Rust source, Codegen spec, Gradle/CMake integration, and Android TurboModule registration. The binding pattern is reusable; Android task names and React Native bootstrap files are version-sensitive and must match the RN version installed in your project.
