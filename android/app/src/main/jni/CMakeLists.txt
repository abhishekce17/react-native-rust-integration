cmake_minimum_required(VERSION 3.13)
project(appmodules)

# React Native supplies the JSI, Fabric and TurboModule build configuration.
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# shared/ is at the GamePrototype root, beside android/ and oxide-rust/.
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    ../../../../../shared/NativeRustEngine.cpp
)

target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
    ../../../../../shared
    ../../../../../oxide-rust/include
)

# Prebuilt Rust library selected for the ABI Gradle is building.
set(OXIDE_RUST_LIBRARY
    "${CMAKE_CURRENT_LIST_DIR}/../rustLibs/${ANDROID_ABI}/liboxide_rust.so")

if(NOT EXISTS "${OXIDE_RUST_LIBRARY}")
    message(FATAL_ERROR
        "Rust library not found: ${OXIDE_RUST_LIBRARY}. "
        "Build oxide-rust with cargo-ndk first.")
endif()

add_library(oxide_rust SHARED IMPORTED GLOBAL)
set_target_properties(oxide_rust PROPERTIES
    IMPORTED_LOCATION "${OXIDE_RUST_LIBRARY}"
    IMPORTED_SONAME "liboxide_rust.so"
)

target_link_libraries(${CMAKE_PROJECT_NAME} oxide_rust)