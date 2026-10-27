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
