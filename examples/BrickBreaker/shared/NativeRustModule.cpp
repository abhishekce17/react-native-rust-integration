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

} // namespace

NativeRustModule::NativeRustModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeRustModuleCxxSpec(std::move(jsInvoker)),
      state_(std::make_shared<GameStateHolder>()) {}

NativeRustModule::~NativeRustModule() = default;

void NativeRustModule::install(Runtime& runtime) {
  Object api(runtime);

  // Copy shared state pointer once into local scope so every HostFunction lambda
  auto state = state_;

  // Initialize or recreate native game state
  api.setProperty(
      runtime,
      "init",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "init"),
          2,
          [state](Runtime& rt, const Value&, const Value* args, std::size_t count) -> Value {
            if (count < 2 || !args[0].isNumber() || !args[1].isNumber()) {
              throw JSError(rt, "init(width, height) expects 2 numbers");
            }
            float w = static_cast<float>(args[0].asNumber());
            float h = static_cast<float>(args[1].asNumber());
            state->game = std::shared_ptr<RustGame>(rust_game_create(w, h), rust_game_destroy);
            return Value::undefined();
          }));

  // Reset current game
  api.setProperty(
      runtime,
      "reset",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "reset"),
          0,
          [state](Runtime& rt, const Value&, const Value*, std::size_t) -> Value {
            if (state->game) {
              rust_game_reset(state->game.get());
            }
            return Value::undefined();
          }));

  // Launch poised ball
  api.setProperty(
      runtime,
      "launch",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "launch"),
          0,
          [state](Runtime& rt, const Value&, const Value*, std::size_t) -> Value {
            if (state->game) {
              rust_game_launch(state->game.get());
            }
            return Value::undefined();
          }));

  // Update paddle position & tilt
  api.setProperty(
      runtime,
      "setPaddle",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "setPaddle"),
          2,
          [state](Runtime& rt, const Value&, const Value* args, std::size_t count) -> Value {
            if (state->game && count >= 2 && args[0].isNumber() && args[1].isNumber()) {
              float x = static_cast<float>(args[0].asNumber());
              float tilt = static_cast<float>(args[1].asNumber());
              rust_game_set_paddle(state->game.get(), x, tilt);
            }
            return Value::undefined();
          }));

  // Advance simulation frame by dt
  api.setProperty(
      runtime,
      "step",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "step"),
          1,
          [state](Runtime& rt, const Value&, const Value* args, std::size_t count) -> Value {
            if (state->game && count >= 1 && args[0].isNumber()) {
              float dt = static_cast<float>(args[0].asNumber());
              rust_game_step(state->game.get(), dt);
            }
            return Value::undefined();
          }));

  // Scalar queries
  api.setProperty(
      runtime,
      "getState",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getState"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(0);
            return Value(static_cast<double>(rust_game_get_state(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getScore",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getScore"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(0);
            return Value(static_cast<double>(rust_game_get_score(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getLives",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getLives"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(3);
            return Value(static_cast<double>(rust_game_get_lives(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getCombo",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getCombo"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(1.0);
            return Value(static_cast<double>(rust_game_get_combo(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getPaddleX",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getPaddleX"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(0.0);
            return Value(static_cast<double>(rust_game_get_paddle_x(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getPaddleWidth",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getPaddleWidth"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(130.0);
            return Value(static_cast<double>(rust_game_get_paddle_width(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getAimAngle",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getAimAngle"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(-1.57);
            return Value(static_cast<double>(rust_game_get_aim_angle(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getLevel",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getLevel"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(1.0);
            return Value(static_cast<double>(rust_game_get_level(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "getEvents",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getEvents"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value(0.0);
            return Value(static_cast<double>(rust_game_get_events(state->game.get())));
          }));

  api.setProperty(
      runtime,
      "setLevel",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "setLevel"),
          1,
          [state](Runtime&, const Value&, const Value* args, std::size_t count) -> Value {
            if (state->game && count >= 1 && args[0].isNumber()) {
              uint32_t lvl = static_cast<uint32_t>(args[0].asNumber());
              rust_game_set_level(state->game.get(), lvl);
            }
            return Value::undefined();
          }));

  api.setProperty(
      runtime,
      "nextLevel",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "nextLevel"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (state->game) {
              rust_game_next_level(state->game.get());
            }
            return Value::undefined();
          }));

  api.setProperty(
      runtime,
      "revive",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "revive"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (state->game) {
              rust_game_revive(state->game.get());
            }
            return Value::undefined();
          }));

  api.setProperty(
      runtime,
      "pause",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "pause"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (state->game) {
              rust_game_pause(state->game.get());
            }
            return Value::undefined();
          }));

  api.setProperty(
      runtime,
      "resume",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "resume"),
          0,
          [state](Runtime&, const Value&, const Value*, std::size_t) -> Value {
            if (state->game) {
              rust_game_resume(state->game.get());
            }
            return Value::undefined();
          }));

  // Cache TypedArray and ArrayBuffer constructors once during install
  // Eliminates 100% of runtime string reflection in 60/120 FPS simulation loops
  auto arrayBufferCtor = std::make_shared<Function>(
      runtime.global().getPropertyAsFunction(runtime, "ArrayBuffer"));
  auto float32ArrayCtor = std::make_shared<Function>(
      runtime.global().getPropertyAsFunction(runtime, "Float32Array"));

  // Fast slice getters into Float32Array (safe std::memcpy from Rust buffer into JS ArrayBuffer using cached constructors)
  api.setProperty(
      runtime,
      "getBalls",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getBalls"),
          0,
          [state, arrayBufferCtor, float32ArrayCtor](Runtime& rt, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value::null();
            uintptr_t length = 0;
            const float* source = rust_game_get_balls_data(state->game.get(), &length);
            if (!source || length == 0) return Value::null();

            const std::size_t byteCount = length * sizeof(float);
            Object bufferObject = arrayBufferCtor
                ->callAsConstructor(rt, static_cast<double>(byteCount))
                .asObject(rt);

            ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
            std::memcpy(buffer.data(rt), source, byteCount);

            return float32ArrayCtor->callAsConstructor(rt, bufferObject);
          }));

  api.setProperty(
      runtime,
      "getBricks",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getBricks"),
          0,
          [state, arrayBufferCtor, float32ArrayCtor](Runtime& rt, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value::null();
            uintptr_t length = 0;
            const float* source = rust_game_get_bricks_data(state->game.get(), &length);
            if (!source || length == 0) return Value::null();

            const std::size_t byteCount = length * sizeof(float);
            Object bufferObject = arrayBufferCtor
                ->callAsConstructor(rt, static_cast<double>(byteCount))
                .asObject(rt);

            ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
            std::memcpy(buffer.data(rt), source, byteCount);

            return float32ArrayCtor->callAsConstructor(rt, bufferObject);
          }));

  api.setProperty(
      runtime,
      "getPowerUps",
      Function::createFromHostFunction(
          runtime,
          PropNameID::forAscii(runtime, "getPowerUps"),
          0,
          [state, arrayBufferCtor, float32ArrayCtor](Runtime& rt, const Value&, const Value*, std::size_t) -> Value {
            if (!state->game) return Value::null();
            uintptr_t length = 0;
            const float* source = rust_game_get_powerups_data(state->game.get(), &length);
            if (!source || length == 0) return Value::null();

            const std::size_t byteCount = length * sizeof(float);
            Object bufferObject = arrayBufferCtor
                ->callAsConstructor(rt, static_cast<double>(byteCount))
                .asObject(rt);

            ArrayBuffer buffer = bufferObject.getArrayBuffer(rt);
            std::memcpy(buffer.data(rt), source, byteCount);

            return float32ArrayCtor->callAsConstructor(rt, bufferObject);
          }));

  runtime.global().setProperty(runtime, "RustModule", std::move(api));
}

} // namespace facebook::react

