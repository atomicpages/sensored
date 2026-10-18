// Node 20+ and Bun. `SENSORED_ENGINE=wasm` checks the Wasm fallback; the
// default is the napi addon.
import { getBinding } from "../../dist/src/native/binding.mjs";
import * as sensored from "../../dist/src/index.mjs";
import { smoke } from "./smoke-checks.mjs";

const out = await smoke(sensored);

// Wasm-bindgen classes carry `free`; napi classes don't.
const engine =
  typeof getBinding().Redactor.prototype.free === "function" ? "wasm" : "napi";
const expected = process.env.SENSORED_ENGINE === "wasm" ? "wasm" : "napi";

if (engine !== expected) {
  throw new Error(`smoke: loaded ${engine}, expected ${expected}`);
}

console.log(`${typeof Bun === "undefined" ? "Node.js" : "Bun"} smoke (${engine}): OK`, out);
