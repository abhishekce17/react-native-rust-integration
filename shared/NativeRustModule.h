#pragma once

#include <RustModuleSpecsJSI.h>

#include <memory>

extern "C" {
#include <rust_core.h>
}

namespace facebook::react {

class NativeRustModule
    : public NativeRustModuleCxxSpec<NativeRustModule> {
 public:
  explicit NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~NativeRustModule() override;

  // Codegen's C++ TurboModule method receives the active runtime.
  void install(jsi::Runtime& runtime);

 private:
  RustData* data_{nullptr};
};

} // namespace facebook::react
