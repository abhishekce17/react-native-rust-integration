cmake_minimum_required(VERSION 3.13)
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# Compile C++ JSI host implementation
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ../../../../../shared/NativeRustEngine.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ../../../../../shared
    ../../../../../oxide-core/include
)

# Map Android ABI to Rust target triple
if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(RUST_TARGET "aarch64-linux-android")
elseif(ANDROID_ABI STREQUAL "x86_64")
    set(RUST_TARGET "x86_64-linux-android")
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
    set(RUST_TARGET "armv7-linux-androideabi")
elseif(ANDROID_ABI STREQUAL "x86")
    set(RUST_TARGET "i686-linux-android")
endif()

# Locate the static library archive (.a) in Rust's target directory
set(OXIDE_CORE_STATIC_LIB
    "${CMAKE_CURRENT_LIST_DIR}/../../../../../oxide-core/target/${RUST_TARGET}/release/liboxide_core.a")

if(NOT EXISTS "${OXIDE_CORE_STATIC_LIB}")
    message(FATAL_ERROR "Rust static library not found at: ${OXIDE_CORE_STATIC_LIB}")
endif()

# Import as STATIC library
add_library(oxide_core STATIC IMPORTED GLOBAL)
set_target_properties(oxide_core PROPERTIES
    IMPORTED_LOCATION "${OXIDE_CORE_STATIC_LIB}"
)

# Statically merge Rust into libappmodules.so
target_link_libraries(${CMAKE_PROJECT_NAME} oxide_core)