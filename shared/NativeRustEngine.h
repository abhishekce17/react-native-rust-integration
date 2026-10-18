#pragma once

#include <OxideSpecsJSI.h>
#include <memory>

namespace facebook::react {

class NativeRustEngine
    : public NativeRustEngineCxxSpec<NativeRustEngine> {
 public:
  explicit NativeRustEngine(std::shared_ptr<CallInvoker> jsInvoker);

  // TurboModule startup method: installs globalThis.RustEngine.
  void install(jsi::Runtime& rt);
};

} // namespace facebook::react