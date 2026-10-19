#include "NativeRustModule.h"

#include <cstddef>
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

// Holds UTF-8 storage for as long as the Rust function call needs it.
// The implicit conversion allows a Rust function expecting const char* to
// receive the temporary string buffer for the duration of that call.
struct JsiStringArg {
  std::string value;
  operator const char*() const noexcept { return value.c_str(); }
};

// JS value -> native argument.
//
// `auto` is intentional: for const char* input, return JsiStringArg so the
// temporary storage remains alive until the C ABI call returns.
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
      throw JSError(runtime, "Expected a numeric argument");
    }
    return static_cast<U>(value.asNumber());
  } else if constexpr (std::is_integral_v<U>) {
    if (!value.isNumber()) {
      throw JSError(runtime, "Expected a numeric integer argument");
    }

    const double number = value.asNumber();
    if (number != std::trunc(number) ||
        number < static_cast<double>(std::numeric_limits<U>::lowest()) ||
        number > static_cast<double>(std::numeric_limits<U>::max())) {
      throw JSError(runtime, "Integer argument is fractional or out of range");
    }
    return static_cast<U>(number);
  } else {
    static_assert(!sizeof(U), "Unsupported JSI argument type");
  }
}

// Native return -> JS value.
//
// char* is reserved here for a Rust-owned string returned from a function
// that uses this API's rust_string_free() allocator/deallocator pair.
// Do not use char* return support for memory owned by another allocator.
template <typename T>
Value toJsi(Runtime& runtime, T&& value) {
  using U = std::decay_t<T>;

  if constexpr (std::is_same_v<U, void>) {
    return Value::undefined();
  } else if constexpr (std::is_same_v<U, bool>) {
    return Value(static_cast<bool>(value));
  } else if constexpr (std::is_floating_point_v<U> ||
                       std::is_integral_v<U>) {
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
    auto jsString = jsi::String::createFromUtf8(runtime, value);
    rust_string_free(value);
    return Value(std::move(jsString));
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

  // Exact count matters: ignoring extra values can conceal JS call mistakes.
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

// Generic C++17 binder. It infers argument and return types from the function
// pointer and shares conversion/validation logic among all registered methods.
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

NativeRustModule::~NativeRustModule() {
  if (data_ != nullptr) {
    rust_data_destroy(data_);
    data_ = nullptr;
  }
}

void NativeRustModule::install(Runtime& runtime) {
  Object api(runtime);

  // Generic bindings: one line per compatible Rust C ABI function.
  bind(runtime, api, "add", rust_add);
  bind(runtime, api, "multiply", rust_multiply);
  bind(runtime, api, "isPositive", rust_is_positive);
  bind(runtime, api, "greeting", rust_greeting);

  // Create the optional Rust-owned data instance once for this module.
  if (data_ == nullptr) {
    data_ = rust_data_create(16);
    if (data_ == nullptr) {
      throw JSError(runtime, "Could not allocate the native data instance");
    }
  }

  // Stateful operations are explicit because they need the native-owned
  // pointer and have different lifetime rules from stateless scalar calls.
  api.setProperty(
      runtime,
      "setValue",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "setValue"),
          2,
          [this](Runtime& rt, const Value&, const Value* args,
                 std::size_t count) -> Value {
            if (count != 2 || !args[0].isNumber() || !args[1].isNumber()) {
              throw JSError(rt, "setValue(index, value) expects two numbers");
            }

            const double rawIndex = args[0].asNumber();
            if (rawIndex < 0 || rawIndex != std::trunc(rawIndex)) {
              throw JSError(rt, "index must be a non-negative integer");
            }

            // This example allocates exactly 16 values. Check the bound before
            // converting the double to size_t, so extremely large inputs cannot
            // overflow or produce an out-of-range integer conversion.
            if (rawIndex >= 16.0) {
              return Value(false);
            }

            const auto index = static_cast<std::size_t>(rawIndex);
            const bool success = rust_data_set(
                data_, index, static_cast<float>(args[1].asNumber()));
            return Value(success);
          }));

  api.setProperty(
      runtime,
      "getValues",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getValues"),
          0,
          [this](Runtime& rt, const Value&, const Value*,
                 std::size_t count) -> Value {
            if (count != 0) {
              throw JSError(rt, "getValues() does not accept arguments");
            }

            std::size_t length = 0;
            const float* source = rust_data_values(data_, &length);
            if (source == nullptr || length == 0) {
              return Value::null();
            }

            const std::size_t byteCount = length * sizeof(float);

            // This allocates a JS-owned ArrayBuffer and copies the native
            // memory into it. This is intentionally a COPY, not zero-copy.
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
