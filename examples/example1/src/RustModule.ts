import NativeRustModule from '../specs/NativeRustModule';

export interface RustModuleApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
  isPositive(value: number): boolean;
  greeting(name: string): string | null;
  setValue(index: number, value: number): boolean;
  getValues(): Float32Array | null;
}

declare global {
  // Installed by the native C++ install() method.
  var RustModule: RustModuleApi | undefined;
}

// Calls the C++ TurboModule method. The C++ method installs HostFunctions
// onto globalThis using the active JSI runtime passed by the C++ TurboModule.
NativeRustModule.install();

const moduleInstance = globalThis.RustModule;
if (!moduleInstance) {
  throw new Error(
    'RustModule installation failed. Check Codegen, native registration, and OnLoad.cpp.',
  );
}

export const RustModule: RustModuleApi = moduleInstance;
export default RustModule;
