#pragma once

#include <OxideSpecsJSI.h>
#include <memory>
extern "C" {
#include <oxide_core.h>
}

namespace facebook::react {

class NativeRustEngine : public NativeRustEngineCxxSpec<NativeRustEngine> {
 public:
  explicit NativeRustEngine(std::shared_ptr<CallInvoker> jsInvoker);
  ~NativeRustEngine() override;

  void install(jsi::Runtime& rt);

};

}