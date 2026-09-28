import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "cli/index.ts", "cli/config.ts"],
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
