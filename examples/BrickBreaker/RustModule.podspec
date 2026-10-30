require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name            = "RustModule"
  s.version         = package["version"]
  s.summary         = "Rust integration for React Native via C++ TurboModule"
  s.license         = "MIT"
  s.author          = { "Developer" => "dev@example.com" }
  s.homepage        = "https://github.com/example/react-native-rust-integration"
  s.platforms       = { :ios => "15.1" }
  s.source          = { :git => "https://github.com/example/react-native-rust-integration.git", :tag => "v#{s.version}" }

  # Compile cross-platform C++
  s.source_files    = "shared/**/*.{h,cpp}"
  s.public_header_files = "shared/**/*.h"

  # Vendor the pre-packaged XCFramework
  s.vendored_frameworks = "rust-core/target/RustCore.xcframework"

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "HEADER_SEARCH_PATHS" => "\"$(inherited)\" \"$(PODS_TARGET_SRCROOT)/shared\" \"$(PODS_TARGET_SRCROOT)/rust-core/include\""
  }

  install_modules_dependencies(s)
end

