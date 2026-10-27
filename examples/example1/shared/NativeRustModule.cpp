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

// Holds temporary UTF-8 storage for the duration of the C ABI call.
struct JsiStringArg {
  std::string value;
  operator const char*() const noexcept { return value.c_str(); }
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

    if (number < minTarget || number > maxTarget) {
      throw JSError(
          runtime,
          "Floating-point argument exceeds the target range");
    }

    return static_cast<U>(number);
  } else if constexpr (std::is_integral_v<U>) {
    // 64-bit integers supported via JavaScript BigInt
    if constexpr (std::is_same_v<U, int64_t>) {
      if (value.isBigInt()) {
        return value.getBigInt(runtime).asInt64(runtime);
      }
    } else if constexpr (std::is_same_v<U, uint64_t>) {
      if (value.isBigInt()) {
        return value.getBigInt(runtime).asUint64(runtime);
      }
    }

    if (!value.isNumber()) {
      throw JSError(runtime, "Expected a numeric integer or BigInt argument");
    }

    const double number = value.asNumber();
    if (!std::isfinite(number) || number != std::trunc(number)) {
      throw JSError(runtime, "Integer argument is fractional or non-finite");
    }

    constexpr double kMaxSafeInteger = 9007199254740991.0;
    constexpr double kMinSafeInteger = -9007199254740991.0;

    double lower = kMinSafeInteger;
    double upper = kMaxSafeInteger;

    if constexpr (std::is_signed_v<U>) {
      if constexpr (sizeof(U) < sizeof(int64_t)) {
        lower = static_cast<double>(std::numeric_limits<U>::lowest());
        upper = static_cast<double>(std::numeric_limits<U>::max());
      }
    } else {
      lower = 0.0;
      if constexpr (sizeof(U) < sizeof(uint64_t)) {
        upper = static_cast<double>(std::numeric_limits<U>::max());
      }
    }

    if (number < lower || number > upper) {
      throw JSError(runtime, "Integer argument is out of safe range");
    }
    return static_cast<U>(number);
  } else {
    static_assert(!sizeof(U), "Unsupported JSI argument type");
  }
}

// Native return -> JS value.
template <typename T>
Value toJsi(Runtime& runtime, T&& value) {
  using U = std::decay_t<T>;

  if constexpr (std::is_same_v<U, void>) {
    return Value::undefined();
  } else if constexpr (std::is_same_v<U, bool>) {
    return Value(static_cast<bool>(value));
  } else if constexpr (std::is_same_v<U, int64_t>) {
    return Value(jsi::BigInt::fromInt64(runtime, value));
  } else if constexpr (std::is_same_v<U, uint64_t>) {
    return Value(jsi::BigInt::fromUint64(runtime, value));
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

  // Capture shared_ptr by value so HostFunction owns a strong reference to data,
  // making it completely independent of NativeRustModule's lifetime across Fast Refresh/reload.
  api.setProperty(
      runtime,
      "setValue",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "setValue"),
          2,
          [data = this->data_](Runtime& rt, const Value&, const Value* args,
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

  // Stateful getter: copies Rust memory into JS Float32Array (Safe synchronous copy)
  api.setProperty(
      runtime,
      "getValues",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getValues"),
          0,
          [data = this->data_](Runtime& rt, const Value&, const Value*,
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
