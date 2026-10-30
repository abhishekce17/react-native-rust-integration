#pragma once

#if __has_include(<React-Codegen/RustModuleSpecsJSI.h>) // iOS / CocoaPods
#include <React-Codegen/RustModuleSpecsJSI.h>
#elif __has_include(<RustModuleSpecsJSI.h>) // Android / CMake
#include <RustModuleSpecsJSI.h>
#endif

#include <memory>

struct RustGame;

namespace facebook::react {

class NativeRustModule
    : public NativeRustModuleCxxSpec<NativeRustModule> {
 public:
  constexpr static const char* kModuleName = "NativeRustModule";

  explicit NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~NativeRustModule() override;

  void install(jsi::Runtime& runtime);

 private:
  std::shared_ptr<RustGame> game_{nullptr};
};

} // namespace facebook::react

