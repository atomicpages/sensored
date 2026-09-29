import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapters/pino.ts",
    "src/adapters/winston.ts",
    "src/adapters/openai.ts",
    "src/adapters/anthropic.ts",
    "src/adapters/morgan.ts",
    "cli/index.ts",
    "cli/config.ts",
  ],
  format: "esm",
  dts: true,
  exports: true,
  target: "es2022",
  unbundle: true,
  publint: true,
  attw: true,
  clean: true,
  sourcemap: true,
});
