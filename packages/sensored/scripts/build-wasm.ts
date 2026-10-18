/**
 * Builds `crates/sensored-wasm` into `wasm/` (gitignored): the
 * wasm-bindgen `--target web` glue plus `sensored_wasm_bg.wasm`. tsdown
 * copies the directory to `dist/wasm/`, so `src/native/*` reach it at
 * `../../wasm/` from both source and `dist/src/native/`.
 *
 * Needs the `wasm32-unknown-unknown` target, `wasm-bindgen` (the CLI version
 * pinned in `crates/sensored-wasm/Cargo.toml`) and, optionally, binaryen's
 * `wasm-opt`.
 */
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "..");
const crates = resolve(root, "../../crates");
const out = resolve(root, "wasm");
const built = resolve(
  crates,
  "target/wasm32-unknown-unknown/release/sensored_wasm.wasm",
);
const wasm = resolve(out, "sensored_wasm_bg.wasm");

await $`cargo build --target wasm32-unknown-unknown --release -p sensored-wasm`.cwd(
  crates,
);
await $`rm -rf ${out}`;
await $`wasm-bindgen --target web --out-dir ${out} ${built}`;

// TS resolves `import wasmModule from ".../sensored_wasm_bg.wasm"`
// (`src/native/wasm-module.ts`) through this file. wasm-bindgen writes the
// instance's exports here; Workers and Vercel Edge import a compiled module.
await Bun.write(
  `${wasm}.d.ts`,
  "declare const module: WebAssembly.Module;\nexport default module;\n",
);

if (Bun.which("wasm-opt") === null) {
  console.warn("wasm-opt not found; skipping size optimisation.");
} else {
  await $`wasm-opt -O3 --enable-bulk-memory --enable-nontrapping-float-to-int -o ${wasm} ${wasm}`;
}

const bytes = await Bun.file(wasm).bytes();

console.log(
  `${wasm}: ${bytes.length} bytes, ${Bun.gzipSync(bytes).length} gzipped`,
);
