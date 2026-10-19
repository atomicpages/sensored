import { readFileSync } from "node:fs";

import {
  initSync,
  listDetectorsJson,
  Redactor,
  restore,
} from "../../wasm/sensored_wasm.js";
import type { NativeBinding } from "./binding";

let binding: NativeBinding | undefined;

/**
 * The Wasm build, loaded synchronously: the Node and Bun fallback when the
 * napi addon cannot load, and the engine `SENSORED_ENGINE=wasm` forces.
 *
 * `../../wasm/` is `packages/sensored/wasm/` from source and `dist/wasm/`
 * from `dist/src/native/`. Instantiates once; later calls reuse it.
 */
export function loadWasmSync(): NativeBinding {
  if (binding === undefined) {
    const wasm = new URL("../../wasm/sensored_wasm_bg.wasm", import.meta.url);

    initSync({ module: readFileSync(wasm) });
    binding = { Redactor, restore, listDetectorsJson };
  }

  return binding;
}
