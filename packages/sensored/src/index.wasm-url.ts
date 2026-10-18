/**
 * Browser and Deno entry: the Wasm engine, fetched by URL. Top-level await
 * loads it before any import of this module resolves, so `createRedactor`
 * stays synchronous.
 */
import { setBinding } from "./native/binding";
import { loadWasmUrl } from "./native/wasm-url";

setBinding(await loadWasmUrl());

export * from "./api";
