import NativeRustModule from '../specs/NativeRustModule';

export const RUST_EVENT = {
  PADDLE_HIT: 1 << 0,
  BRICK_HIT: 1 << 1,
  BRICK_DESTROY: 1 << 2,
  POWERUP_COLLECT: 1 << 3,
  LIFE_LOST: 1 << 4,
  LEVEL_COMPLETED: 1 << 5,
  GAME_OVER: 1 << 6,
} as const;

export const RUST_GAME_STATE = {
  READY_TO_LAUNCH: 0,
  ACTIVE: 1,
  LAST_LIFE: 2,
  LEVEL_COMPLETED: 3,
  GAME_OVER: 4,
  PAUSED: 5,
} as const;

export interface RustModuleApi {
  init(width: number, height: number): void;
  reset(): void;
  launch(): void;
  setPaddle(x: number, tilt: number): void;
  step(dt: number): void;
  getState(): number;
  getScore(): number;
  getLives(): number;
  getCombo(): number;
  getPaddleX(): number;
  getPaddleWidth(): number;
  getAimAngle(): number;
  getLevel(): number;
  getEvents(): number;
  setLevel(level: number): void;
  nextLevel(): void;
  revive(): void;
  pause(): void;
  resume(): void;
  getBalls(): Float32Array | null;
  getBricks(): Float32Array | null;
  getPowerUps(): Float32Array | null;
}

declare global {
  var RustModule: RustModuleApi | undefined;
}

// Calls C++ TurboModule install() method to bind HostFunctions to globalThis
try {
  NativeRustModule?.install();
} catch (e) {
  // Graceful fallback during tests or hot reload
}

export const getRustModule = (): RustModuleApi | undefined => globalThis.RustModule;

// Backwards-compatible alias during transition
export const getRustEngine = getRustModule;

