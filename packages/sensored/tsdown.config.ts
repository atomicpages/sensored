import { defineConfig } from "tsdown";

/** Entries that become export conditions of `.` instead of sub-paths. */
const conditions: Record<string, string[]> = {
  "./src/index.wasm-module": ["worker", "edge-light"],
  "./src/index.wasm-url": ["browser", "deno"],
};

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/index.wasm-url.ts",
    "src/index.wasm-module.ts",
    "src/session.ts",
    "src/vault/index.ts",
    "src/adapters/openai.ts",
    "src/adapters/anthropic.ts",
    "src/loggers/bunyan.ts",
    "src/loggers/log4js.ts",
    "src/loggers/morgan.ts",
    "src/loggers/pino.ts",
    "src/loggers/winston.ts",
    "src/loggers/console.ts",
    "cli/index.ts",
    "cli/config.ts",
  ],
  format: "esm",
  dts: true,
  exports: {
    customExports(generated) {
      const clean: Record<string, unknown> = {};
      const root: Record<string, unknown> = {};
      let main: unknown;

      for (const [key, value] of Object.entries(generated)) {
        const names = conditions[key];

        if (names !== undefined) {
          for (const name of names) {
            root[name] = value;
          }
        } else if (key === "./src") {
          main = value;
          clean["."] = root;
        } else if (key.startsWith("./src/")) {
          clean[`./${key.slice(6)}`] = value;
        } else {
          clean[key] = value;
        }
      }

      // Last: conditions match in order, and `default` is the catch-all.
      root.default = main;

      return clean;
    },
  },
  // The Wasm glue and binary (`bun run build:wasm`) stay files of their own:
  // `src/native/wasm-*.ts` reach them at `../../wasm/` from `dist/src/native/`.
  deps: { neverBundle: [/\/wasm\/sensored_wasm/] },
  copy: [
    {
      from: ["wasm/sensored_wasm.js", "wasm/sensored_wasm_bg.wasm"],
      to: "dist/wasm",
    },
  ],
  target: "es2022",
  unbundle: true,
  publint: true,
  attw: true,
  clean: true,
  sourcemap: true,
});
