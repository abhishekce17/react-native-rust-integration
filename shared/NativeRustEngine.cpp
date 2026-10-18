#include "NativeRustEngine.h"

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <type_traits>
#include <utility>
extern "C" {
#include <oxide_core.h>
}

namespace facebook::react {

// =============================================================================
// TRULY GENERIC C++17 JSI AUTO-BINDER
// Works automatically with:
// - ANY return type: void, f64, f32, i32, i64, bool, const char*, std::string
// - ANY arity: 0, 1, 2, 3, 4... parameters
// - ANY primitive argument types
// No hardcoding, no separate bindUnary / bindBinary needed!
// =============================================================================

// Helper struct: converts temporary std::string to const char* while keeping buffer alive
struct JsiStringArg {
  std::string value;
  operator const char*() const noexcept { return value.c_str(); }
};

// 1. Unmarshal: Converts jsi::Value -> native C++ / Rust type
template <typename T>
auto fromJsi(jsi::Runtime& rt, const jsi::Value& v) {
  using CleanT = std::decay_t<T>;
  if constexpr (std::is_same_v<CleanT, const char*>) {
    if (!v.isString()) throw jsi::JSError(rt, "Expected string argument");
    return JsiStringArg{v.getString(rt).utf8(rt)};
  } else if constexpr (std::is_same_v<CleanT, double>) {
    if (!v.isNumber()) throw jsi::JSError(rt, "Expected number argument");
    return v.asNumber();
  } else if constexpr (std::is_same_v<CleanT, float>) {
    if (!v.isNumber()) throw jsi::JSError(rt, "Expected number argument");
    return static_cast<float>(v.asNumber());
  } else if constexpr (std::is_integral_v<CleanT> && !std::is_same_v<CleanT, bool>) {
    if (!v.isNumber()) throw jsi::JSError(rt, "Expected integer argument");
    return static_cast<CleanT>(v.asNumber());
  } else if constexpr (std::is_same_v<CleanT, bool>) {
    if (!v.isBool()) throw jsi::JSError(rt, "Expected boolean argument");
    return v.getBool();
  } else {
    static_assert(!sizeof(CleanT), "Unsupported argument type for JSI auto-binder");
  }
}

// 2. Marshal: Converts native C++ / Rust return value -> jsi::Value
template <typename Ret>
jsi::Value toJsi(jsi::Runtime& rt, Ret&& value) {
  using CleanRet = std::decay_t<Ret>;
  if constexpr (std::is_void_v<CleanRet>) {
    return jsi::Value::undefined();
  } else if constexpr (std::is_floating_point_v<CleanRet> || (std::is_integral_v<CleanRet> && !std::is_same_v<CleanRet, bool>)) {
    return jsi::Value(static_cast<double>(value));
  } else if constexpr (std::is_same_v<CleanRet, bool>) {
    return jsi::Value(static_cast<bool>(value));
  } else if constexpr (std::is_same_v<CleanRet, const char*>) {
    if (!value) return jsi::Value::null();
    return jsi::String::createFromUtf8(rt, value);
  } else if constexpr (std::is_same_v<CleanRet, std::string>) {
    return jsi::String::createFromUtf8(rt, value);
  } else {
    static_assert(!sizeof(CleanRet), "Unsupported return type for JSI auto-binder");
  }
}

// 3. Variadic unpacker: expands arguments using std::index_sequence
template <typename Ret, typename... Args, size_t... Is>
jsi::Value invokeRustFn(
    jsi::Runtime& rt,
    Ret (*fn)(Args...),
    const jsi::Value* args,
    size_t count,
    std::index_sequence<Is...>) {
  constexpr size_t expectedCount = sizeof...(Args);
  if (count < expectedCount) {
    throw jsi::JSError(
        rt,
        "Insufficient arguments: expected " + std::to_string(expectedCount) +
            ", but received " + std::to_string(count));
  }
  if constexpr (std::is_void_v<Ret>) {
    fn(fromJsi<Args>(rt, args[Is])...);
    return jsi::Value::undefined();
  } else {
    return toJsi(rt, fn(fromJsi<Args>(rt, args[Is])...));
  }
}

// 4. Master 1-line binding function: deduces Ret and all Args... automatically
template <typename Ret, typename... Args>
void bind(jsi::Runtime& rt, jsi::Object& target, const char* name, Ret (*fn)(Args...)) {
  constexpr size_t arity = sizeof...(Args);
  target.setProperty(
      rt,
      name,
      jsi::Function::createFromHostFunction(
          rt,
          jsi::PropNameID::forAscii(rt, name),
          static_cast<unsigned int>(arity),
          [fn](jsi::Runtime& runtime, const jsi::Value&, const jsi::Value* args, size_t count) -> jsi::Value {
            return invokeRustFn(runtime, fn, args, count, std::make_index_sequence<arity>{});
          }));
}

NativeRustEngine::NativeRustEngine(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeRustEngineCxxSpec(std::move(jsInvoker)) {}

 NativeRustEngine::~NativeRustEngine() = default;

 void NativeRustEngine::install(jsi::Runtime& rt) {
  jsi::Object api(rt);
  bind(rt, api, "run_loop", run_loop); 

   rt.global().setProperty(rt, "RustEngine", std::move(api));
}

} // namespace facebook::react