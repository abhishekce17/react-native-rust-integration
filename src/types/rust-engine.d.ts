export {};

declare global {
  var RustEngine:
    | {
        run_loop(i: number): number;
      }
    | undefined;
}
