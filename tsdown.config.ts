import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapters/openai.ts",
    "src/adapters/anthropic.ts",
    "src/loggers/bunyan.ts",
    "src/loggers/log4js.ts",
    "src/loggers/morgan.ts",
    "src/loggers/pino.ts",
    "src/loggers/winston.ts",
    "cli/index.ts",
    "cli/config.ts",
  ],
  format: "esm",
  dts: true,
  exports: {
    customExports(generated) {
      const clean: Record<string, string> = {};

      for (const [key, value] of Object.entries(generated)) {
        if (key === "./src") {
          clean["."] = value;
        } else if (key.startsWith("./src/")) {
          clean[`./${key.slice(6)}`] = value;
        } else {
          clean[key] = value;
        }
      }

      return clean;
    },
  },
  target: "es2022",
  unbundle: true,
  publint: true,
  attw: true,
  clean: true,
  sourcemap: true,
});
