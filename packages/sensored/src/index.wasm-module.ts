/**
 * Cloudflare Workers and Vercel Edge entry: the Wasm engine, imported as a
 * precompiled module. Top-level await loads it before any import of this
 * module resolves, so `createRedactor` stays synchronous.
 */
import { setBinding } from "./native/binding";
import { loadWasmModule } from "./native/wasm-module";

setBinding(await loadWasmModule());

export * from "./api";
