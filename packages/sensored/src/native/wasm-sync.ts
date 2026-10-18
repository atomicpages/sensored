import type { NativeBinding } from "./binding";

/**
 * The Wasm build, loaded synchronously: the Node and Bun fallback when the
 * napi addon cannot load, and the engine `SENSORED_ENGINE=wasm` forces.
 *
 * Stub until `crates/sensored-wasm` lands (phase 4b).
 */
export function loadWasmSync(): NativeBinding {
  throw new Error("sensored: the Wasm engine is not built yet.");
}
