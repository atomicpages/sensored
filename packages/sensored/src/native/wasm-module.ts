import init, {
  listDetectorsJson,
  Redactor,
  restore,
} from "../../wasm/sensored_wasm.js";
// Cloudflare Workers and Vercel Edge compile `.wasm` imports at deploy time
// and block compiling Wasm bytes at runtime, so the module is imported, not
// fetched. The import is bundler-specific: wrangler takes it as is, while
// Vercel Edge (and some bundlers) want `?module` or a Wasm plugin.
import wasmModule from "../../wasm/sensored_wasm_bg.wasm";
import type { NativeBinding } from "./binding";

/** The Wasm build, precompiled by the platform: Workers and Vercel Edge. */
export async function loadWasmModule(): Promise<NativeBinding> {
  await init({ module_or_path: wasmModule });

  return { Redactor, restore, listDetectorsJson };
}
