// Deno loads the Wasm entry (the package's `deno` export condition).
import * as sensored from "../../dist/src/index.wasm-url.mjs";
import { smoke } from "./smoke-checks.mjs";

console.log("Deno smoke (wasm): OK", await smoke(sensored));
