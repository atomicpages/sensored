import type { NativeBinding } from "../../../packages/sensored/src/native/binding";
import { loadWasmSync } from "../../../packages/sensored/src/native/wasm-sync";
import {
  listDetectorsJson,
  Redactor,
  restore,
} from "../../sensored-napi/index.js";

export const napi: NativeBinding = { Redactor, restore, listDetectorsJson };
export const wasm: NativeBinding = loadWasmSync();

/** `[name, binding]` pairs for `describe.each`. */
export const engines: [string, NativeBinding][] = [
  ["napi", napi],
  ["wasm", wasm],
];
