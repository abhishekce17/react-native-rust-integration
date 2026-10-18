# Oxide Engine: React Native + Hermes/JSI + C++ + Rust (Dynamic `.so` Architecture)

This guide documents the **Dynamic Shared Library (`cdylib` / `.so`)** integration pattern between React Native (New Architecture) and Rust on Android and Windows.

```text
RN_Rust_Integration/
└── GamePrototype/                 # React Native project root
    ├── package.json
    ├── App.tsx
    ├── android/
    │   ├── gradle.properties
    │   └── app/
    │       ├── build.gradle
    │       └── src/main/
    │           ├── java/com/gameprototype/MainApplication.kt
    │           ├── jni/
    │           │   ├── CMakeLists.txt
    │           │   └── OnLoad.cpp
    │           └── rustLibs/       # Output directory for cargo-ndk
    │               ├── arm64-v8a/liboxide_rust.so
    │               └── x86_64/liboxide_rust.so
    ├── shared/                    # Sits at project root beside android/ and oxide-rust/
    │   ├── NativeRustEngine.h
    │   └── NativeRustEngine.cpp
    ├── specs/
    │   └── NativeRustEngine.ts
    └── oxide-rust/                # Rust crate
        ├── Cargo.toml
        ├── .cargo/
        │   └── config.toml        # Critical: Sets ELF DT_SONAME
        ├── src/
        │   └── lib.rs
        └── include/
            └── oxide_rust.h
```

**Critical location rule:** `shared/` sits at the root beside `android/` and `oxide-rust/`. Do **not** place `shared/` inside `android/app/src/main/cpp/`.

---

## Architecture Flow

```text
JS / Hermes
  globalThis.RustEngine.add(20, 22)
          │ Direct JSI Host Function call (zero JNI overhead)
          ▼
C++ JSI Host Function in shared/NativeRustEngine.cpp (compiled into libappmodules.so)
          │ C ABI function call
          ▼
liboxide_rust.so  →  oxide_add(20.0, 22.0)
          │
          ▼
         42
```

A C++ TurboModule provides the one-time `install()` hook. Once installed, every `RustEngine.add()` call goes through Hermes $\rightarrow$ JSI $\rightarrow$ C++ $\rightarrow$ Rust. There is no Kotlin/Java wrapper in the execution path.

---

## Step 1 — Configure the Rust Crate

### File: `oxide-rust/Cargo.toml`
```toml
[package]
name = "oxide-rust"
version = "0.1.0"
edition = "2024"

[lib]
name = "oxide_rust"
crate-type = ["staticlib", "cdylib"]

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = 3
```

> [!IMPORTANT]
> Always set `panic = "abort"`. Unwinding across the FFI boundary between Rust and C++ causes undefined behavior and app crashes.

### File: `oxide-rust/.cargo/config.toml` (CRITICAL)
Without this file, Rust compiles `.so` files **without an internal `DT_SONAME` header**. CMake will then hardcode the host machine's Windows path (`C:/Users/.../liboxide_rust.so`) into `libappmodules.so`, causing Android to fail with `SoLoaderDSONotFoundError` and crashing with `'PlatformConstants' could not be found`.

```toml
[target.aarch64-linux-android]
rustflags = ["-C", "link-arg=-Wl,-soname,liboxide_rust.so"]

[target.x86_64-linux-android]
rustflags = ["-C", "link-arg=-Wl,-soname,liboxide_rust.so"]

[target.armv7-linux-androideabi]
rustflags = ["-C", "link-arg=-Wl,-soname,liboxide_rust.so"]

[target.i686-linux-android]
rustflags = ["-C", "link-arg=-Wl,-soname,liboxide_rust.so"]
```

### File: `oxide-rust/src/lib.rs`
```rust
#[unsafe(no_mangle)]
pub extern "C" fn oxide_add(left: f64, right: f64) -> f64 {
    left + right
}
```

### File: `oxide-rust/include/oxide_rust.h`
```c
#ifndef OXIDE_RUST_H
#define OXIDE_RUST_H

#ifdef __cplusplus
extern "C" {
#endif

double oxide_add(double left, double right);

#ifdef __cplusplus
}
#endif

#endif /* OXIDE_RUST_H */
```

---

## Step 2 — Configure Target ABIs

In `android/gradle.properties`, limit the built ABIs to the architectures you actually need (speeds up build time significantly):

```properties
reactNativeArchitectures=arm64-v8a,x86_64
newArchEnabled=true
hermesEnabled=true
```

---

## Step 3 — Create Shared C++ JSI Bindings

### File: `shared/NativeRustEngine.h`
```cpp
#pragma once

#include <OxideSpecsJSI.h>
#include <memory>

namespace facebook::react {

class NativeRustEngine
    : public NativeRustEngineCxxSpec<NativeRustEngine> {
 public:
  explicit NativeRustEngine(std::shared_ptr<CallInvoker> jsInvoker);

  // TurboModule startup method: installs globalThis.RustEngine
  void install(jsi::Runtime& rt);
};

} // namespace facebook::react
```

### File: `shared/NativeRustEngine.cpp`
```cpp
#include "NativeRustEngine.h"

#include <cstddef>
#include <utility>
#include <oxide_rust.h>

namespace facebook::react {

NativeRustEngine::NativeRustEngine(
    std::shared_ptr<CallInvoker> jsInvoker)
    : NativeRustEngineCxxSpec(std::move(jsInvoker)) {}

void NativeRustEngine::install(jsi::Runtime& rt) {
  jsi::Object engine(rt);

  auto addFunction = jsi::Function::createFromHostFunction(
      rt,
      jsi::PropNameID::forAscii(rt, "add"),
      2,
      [](jsi::Runtime& runtime,
         const jsi::Value& /*thisValue*/,
         const jsi::Value* args,
         std::size_t count) -> jsi::Value {
        if (count != 2 || !args[0].isNumber() || !args[1].isNumber()) {
          throw jsi::JSError(
              runtime,
              "RustEngine.add expects exactly two numeric arguments");
        }

        const double a = args[0].getNumber();
        const double b = args[1].getNumber();
        const double result = oxide_add(a, b);
        return jsi::Value(result);
      });

  engine.setProperty(rt, "add", jsi::Value(std::move(addFunction)));
  rt.global().setProperty(rt, "RustEngine", jsi::Value(std::move(engine)));
}

} // namespace facebook::react
```

---

## Step 4 — Define TurboModule Spec & Codegen

### File: `specs/NativeRustEngine.ts`
```ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  install(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeRustEngine');
```

### Update `package.json`
Add `codegenConfig` at the root level of `package.json`:
```json
  "codegenConfig": {
    "name": "OxideSpecs",
    "type": "modules",
    "jsSrcsDir": "specs",
    "android": {
      "javaPackageName": "com.oxideengine.specs"
    }
  },
```

---

## Step 5 — Configure Android Native CMake & OnLoad

### File: `android/app/src/main/jni/CMakeLists.txt`
```cmake
cmake_minimum_required(VERSION 3.13)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ../../../../../shared/NativeRustEngine.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ../../../../../shared
    ../../../../../oxide-rust/include
)

set(OXIDE_RUST_LIBRARY
    "${CMAKE_CURRENT_LIST_DIR}/../rustLibs/${ANDROID_ABI}/liboxide_rust.so")

if(NOT EXISTS "${OXIDE_RUST_LIBRARY}")
    message(FATAL_ERROR
        "Rust library not found: ${OXIDE_RUST_LIBRARY}. "
        "Build oxide-rust with cargo-ndk first.")
endif()

add_library(oxide_rust SHARED IMPORTED GLOBAL)
set_target_properties(oxide_rust PROPERTIES
    IMPORTED_LOCATION "${OXIDE_RUST_LIBRARY}"
    IMPORTED_SONAME "liboxide_rust.so"  # CRITICAL: prevents host path from leaking into DT_NEEDED
)

target_link_libraries(${CMAKE_PROJECT_NAME} oxide_rust)
```

### File: `android/app/src/main/jni/OnLoad.cpp`
Copy the template from `node_modules/react-native/ReactAndroid/cmake-utils/default-app-setup/OnLoad.cpp` to `android/app/src/main/jni/OnLoad.cpp`.

Add `#include <NativeRustEngine.h>` and register `NativeRustEngine` inside `cxxModuleProvider`:

```cpp
#include <NativeRustEngine.h>

std::shared_ptr<TurboModule> cxxModuleProvider(
    const std::string& name,
    const std::shared_ptr<CallInvoker>& jsInvoker) {
  if (name == NativeRustEngine::kModuleName) {
    return std::make_shared<NativeRustEngine>(jsInvoker);
  }

  return autolinking_cxxModuleProvider(name, jsInvoker);
}
```

---

## Step 6 — Automate the Rust Build in Gradle

In `android/app/build.gradle`:

1. Point to the custom CMake file:
```groovy
android {
    ...
    externalNativeBuild {
        cmake {
            path "src/main/jni/CMakeLists.txt"
        }
    }
}
```

2. Add the automated `buildRust` task at the bottom of `android/app/build.gradle`:
```groovy
def targetArchitectures = (project.findProperty("reactNativeArchitectures") ?: "arm64-v8a,x86_64").split(",")

tasks.register("buildRust", Exec) {
    description = "Compiles oxide-rust via cargo-ndk for configured Android architectures"
    workingDir file("${rootDir}/../oxide-rust")

    def cargoArgs = ["cargo", "ndk"]
    targetArchitectures.each { arch ->
        def trimmedArch = arch.trim()
        if (!trimmedArch.isEmpty()) {
            cargoArgs.addAll(["-t", trimmedArch])
        }
    }
    cargoArgs.addAll(["-o", "../android/app/src/main/rustLibs", "build", "--release"])

    if (org.gradle.internal.os.OperatingSystem.current().isWindows()) {
        commandLine(["cmd", "/c"] + cargoArgs)
    } else {
        commandLine(cargoArgs)
    }
}

tasks.configureEach { task ->
    if (task.name.startsWith("configureCMake") || task.name.startsWith("externalNativeBuild")) {
        task.dependsOn("buildRust")
    }
}
preBuild.dependsOn("buildRust")
```

---

## Step 7 — Pre-load Rust in Android Application

In `android/app/src/main/java/com/gameprototype/MainApplication.kt`:
Explicitly load `liboxide_rust.so` before initializing React Native:

```kotlin
  override fun onCreate() {
    super.onCreate()
    System.loadLibrary("oxide_rust")
    loadReactNative(this)
  }
```

---

## Step 8 — UI Smoke Test & TypeScript Declarations

### File: `src/types/rust-engine.d.ts`
```ts
export {};

declare global {
  var RustEngine:
    | {
        add(a: number, b: number): number;
      }
    | undefined;
}
```

### File: `App.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import NativeRustEngine from './specs/NativeRustEngine';

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState('Installing JSI Host Function…');
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    try {
      NativeRustEngine.install();
      if (typeof globalThis.RustEngine?.add !== 'function') {
        throw new Error('RustEngine.add was not installed');
      }
      setStatus('JSI Host Function installed successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Installation failed: ${message}`);
    }
  }, []);

  const callRust = () => {
    try {
      const engine = globalThis.RustEngine;
      if (!engine) throw new Error('RustEngine is not installed');
      const value = engine.add(20, 22);
      setResult(value);
      setStatus('Success: Hermes → JSI → C++ → Rust');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Call failed: ${message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Oxide Engine</Text>
        <Text style={styles.subtitle}>Hermes + JSI + C++ + Rust</Text>
        <Text style={styles.status}>{status}</Text>
        <Button title="Call Rust: 20 + 22" onPress={callRust} />
        <Text style={styles.result}>Result: {result === null ? 'Not called yet' : result}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#10141c' },
  card: { gap: 16, padding: 24, borderRadius: 16, backgroundColor: '#1b2330' },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '700' },
  subtitle: { color: '#b8c7dc', fontSize: 16 },
  status: { color: '#e3eaf4', fontSize: 14 },
  result: { color: '#72e6a2', fontSize: 24, fontWeight: '700' },
});
```

---

## Step 9 — Run the App

1. Run Metro bundler:
   ```bash
   npx react-native start --reset-cache
   ```
2. In another terminal, build and run:
   ```bash
   npm run android
   ```
   Gradle automatically invokes `cargo-ndk`, compiles Rust, passes libraries to CMake, and starts the app on the emulator. Clicking the button yields **`Result: 42`**.

---

## Troubleshooting Guide

### Issue: `'PlatformConstants' could not be found` (Red Screen)
* **Symptom:** The app immediately crashes on launch with `Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'PlatformConstants' could not be found`.
* **Cause:** `libappmodules.so` crashed on `dlopen` because it contained a host path dependency (e.g., `C:/Users/.../liboxide_rust.so`). React Native silenced the `UnsatisfiedLinkError`, causing TurboModule registration to fail completely.
* **Fix:**
  1. Ensure `oxide-rust/.cargo/config.toml` contains `rustflags = ["-C", "link-arg=-Wl,-soname,liboxide_rust.so"]`.
  2. Ensure `CMakeLists.txt` sets `IMPORTED_SONAME "liboxide_rust.so"`.
  3. Ensure `System.loadLibrary("oxide_rust")` is called in `MainApplication.kt`.
  4. Run `./gradlew clean` and rebuild.

---

## Step 10 — Scaling to a Full Game Engine (Multi-File Rust + Skia)

When expanding from a single `oxide_add` function to a complete game engine:

### 1. Multi-file Rust Architecture
Split your engine into domain submodules:
```text
oxide-rust/src/
├── lib.rs          # Public extern "C" FFI export functions
├── engine.rs       # Engine state, game loop, entity manager
├── math.rs         # Vec2, Matrix, Transform (#[repr(C)])
└── physics/        # Collisions, rigid bodies, raycasts
    ├── mod.rs
    └── collider.rs
```

### 2. Automated Header Generation (`cbindgen`)
Do not write C headers manually for dozens of functions. Add `cbindgen` to `oxide-rust/Cargo.toml`:
```toml
[build-dependencies]
cbindgen = "0.28"
```
And create `oxide-rust/build.rs` to regenerate `include/oxide_rust.h` automatically on every `cargo build`.

### 3. Stateful Engine Pointer Pattern (Opaque Handles)
Rather than global mutable state, allocate the engine on the Rust heap:
```rust
#[unsafe(no_mangle)]
pub extern "C" fn oxide_engine_create() -> *mut GameEngine {
    Box::into_raw(Box::new(GameEngine::new()))
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn oxide_engine_step(ptr: *mut GameEngine, dt: f32) {
    if let Some(engine) = ptr.as_mut() {
        engine.step(dt);
    }
}
```

### 4. Zero-Copy Skia Render Buffers (Float32Array)
For drawing thousands of entities in React Native Skia without serialization overhead:
* Store transforms in Rust as a flat `Vec<f32>`: `[x, y, rotation, scale, ...]`.
* In C++ JSI, expose a method that wraps the raw pointer using `jsi::ArrayBuffer`.
* In JavaScript, pass the `Float32Array` directly into Skia Canvas, Atlas, or Picture draw loops.

