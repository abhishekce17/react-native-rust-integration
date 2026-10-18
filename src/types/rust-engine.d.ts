export {};

declare global {
  var RustEngine:
    | {
        add(a: number, b: number): number;
      }
    | undefined;
}
