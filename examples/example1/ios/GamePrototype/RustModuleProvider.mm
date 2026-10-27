#import "RustModuleProvider.h"
#import <ReactCommon/CallInvoker.h>
#import <ReactCommon/TurboModule.h>

#if __has_include(<RustModule/NativeRustModule.h>)
#import <RustModule/NativeRustModule.h>
#elif __has_include("NativeRustModule.h")
#import "NativeRustModule.h"
#endif

@implementation RustModuleProvider

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeRustModule>(params.jsInvoker);
}

@end
