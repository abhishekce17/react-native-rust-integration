#pragma once

#if __has_include(<React-Codegen/RustModuleSpecsJSI.h>) // iOS / CocoaPods
#include <React-Codegen/RustModuleSpecsJSI.h>
#elif __has_include(<RustModuleSpecsJSI.h>) // Android / CMake
#include <RustModuleSpecsJSI.h>
#endif

#include <memory>

struct RustGame;

namespace facebook::react {

struct GameStateHolder {
  std::shared_ptr<RustGame> game{nullptr};
};

class NativeRustModule
    : public NativeRustModuleCxxSpec<NativeRustModule> {
 public:
  constexpr static const char* kModuleName = "NativeRustModule";

  explicit NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker);
  ~NativeRustModule() override;

  void install(jsi::Runtime& runtime);

 private:
  // std::shared_ptr ensures safe, lifetime-managed native game state that is
  // captured by value in JSI HostFunctions, avoiding dangling [this] pointer
  // crashes across JS reloads/Fast Refresh.
  std::shared_ptr<GameStateHolder> state_;
};

} // namespace facebook::react

