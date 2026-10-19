import init, {
  listDetectorsJson,
  Redactor,
  restore,
} from "../../wasm/sensored_wasm.js";
import type { NativeBinding } from "./binding";

/**
 * The Wasm build, fetched by URL: browsers and Deno. `../../wasm/` is
 * `dist/wasm/` from `dist/src/native/`.
 */
export async function loadWasmUrl(): Promise<NativeBinding> {
  await init({
    module_or_path: new URL(
      "../../wasm/sensored_wasm_bg.wasm",
      import.meta.url,
    ),
  });

  return { Redactor, restore, listDetectorsJson };
}
