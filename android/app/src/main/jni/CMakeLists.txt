cmake_minimum_required(VERSION 3.13)
project(appmodules)

# Keep this include for the React Native native build.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Compile the integration C++ file into the app's native target.
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../shared/NativeRustModule.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../shared
    ${CMAKE_CURRENT_LIST_DIR}/../../../../../rust-core/include
)

# Match the Rust target triple to the Android ABI CMake is building.
if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(RUST_TARGET "aarch64-linux-android")
elseif(ANDROID_ABI STREQUAL "x86_64")
    set(RUST_TARGET "x86_64-linux-android")
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
    set(RUST_TARGET "armv7-linux-androideabi")
elseif(ANDROID_ABI STREQUAL "x86")
    set(RUST_TARGET "i686-linux-android")
else()
    message(FATAL_ERROR "Unsupported Android ABI: ${ANDROID_ABI}")
endif()

set(RUST_CORE_ARCHIVE
    "${CMAKE_CURRENT_LIST_DIR}/../../../../../rust-core/target/${RUST_TARGET}/release/librust_core.a"
)

if(NOT EXISTS "${RUST_CORE_ARCHIVE}")
    message(FATAL_ERROR "Rust archive not found: ${RUST_CORE_ARCHIVE}")
endif()

add_library(rust_core STATIC IMPORTED GLOBAL)
set_target_properties(rust_core PROPERTIES
    IMPORTED_LOCATION "${RUST_CORE_ARCHIVE}"
)

target_link_libraries(${CMAKE_PROJECT_NAME} rust_core)
