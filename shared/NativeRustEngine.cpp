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