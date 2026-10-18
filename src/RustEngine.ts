import NativeRustEngine from '../specs/NativeRustEngine';

// Self-installs JSI host functions onto global scope on initial import
if (typeof globalThis.RustEngine === 'undefined') {
  NativeRustEngine.install();
}

export const RustEngine = globalThis.RustEngine!;
export default RustEngine;
