import { createRequire } from "node:module";
import type { NativeBinding } from "./binding";
import { loadWasmSync } from "./wasm-sync";

/**
 * The Node and Bun engine: the napi addon, or the Wasm build when the addon
 * cannot load or `SENSORED_ENGINE=wasm` forces it.
 */
export function loadNodeBinding(): NativeBinding {
  if (process.env.SENSORED_ENGINE === "wasm") {
    return loadWasmSync();
  }

  let napi: typeof import("@sensored/native");

  try {
    napi = createRequire(import.meta.url)("@sensored/native");
  } catch {
    return loadWasmSync();
  }

  // Type-checked: the addon's generated API satisfies the engine contract.
  return napi;
}
