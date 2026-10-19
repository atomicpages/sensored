/**
 * Compiles the CLI into a standalone binary (`bun build --compile`) with the
 * napi addon for its target embedded.
 *
 * Bun embeds an N-API addon only through a static `require("./x.node")`, and
 * the regular loader (`src/native/node.ts`) resolves `@sensored/native` at
 * runtime, so the binary would find neither the addon nor the Wasm file. A
 * plugin swaps that module for a static require of the target's `.node`.
 * The published `sensored` bin (`dist/cli/index.mjs`) is unaffected.
 *
 * Usage:
 *   bun scripts/build-cli.ts --outfile <path> [--target bun-linux-x64] [--addon <path>]
 *
 * `--target` defaults to the host; `--addon` defaults to the matching
 * `crates/sensored-napi/sensored.<platform>.node`.
 */
import { resolve } from "node:path";
import { parseArgs } from "node:util";

/** Bun compile target to napi-rs platform suffix (the 7 napi targets). */
const PLATFORMS = {
  "bun-darwin-arm64": "darwin-arm64",
  "bun-darwin-x64": "darwin-x64",
  "bun-linux-x64": "linux-x64-gnu",
  "bun-linux-x64-musl": "linux-x64-musl",
  "bun-linux-arm64": "linux-arm64-gnu",
  "bun-linux-arm64-musl": "linux-arm64-musl",
  "bun-windows-x64": "win32-x64-msvc",
} as const satisfies Partial<Record<Bun.Build.CompileTarget, string>>;

type Target = keyof typeof PLATFORMS;

function isTarget(value: string): value is Target {
  return Object.hasOwn(PLATFORMS, value);
}

const root = resolve(import.meta.dir, "..");

const { values } = parseArgs({
  options: {
    target: {
      type: "string",
      default: `bun-${process.platform}-${process.arch}`,
    },
    addon: { type: "string" },
    outfile: { type: "string" },
  },
});

const target = values.target.replace("bun-win32-", "bun-windows-");

if (!isTarget(target)) {
  throw new Error(
    `Unsupported target ${target}; expected one of ${Object.keys(PLATFORMS).join(", ")}.`,
  );
}

const platform = PLATFORMS[target];

if (values.outfile === undefined) {
  throw new Error("--outfile is required.");
}

const addon = resolve(
  values.addon ??
    resolve(root, `../../crates/sensored-napi/sensored.${platform}.node`),
);

if (!(await Bun.file(addon).exists())) {
  throw new Error(`Addon not found: ${addon}`);
}

const result = await Bun.build({
  entrypoints: [resolve(root, "cli/index.ts")],
  compile: {
    target,
    outfile: resolve(values.outfile),
  },
  plugins: [
    {
      name: "embed-napi-addon",
      setup(build) {
        build.onLoad({ filter: /[\\/]src[\\/]native[\\/]node\.ts$/ }, () => ({
          loader: "ts",
          contents: [
            'import type { NativeBinding } from "./binding";',
            "",
            "export function loadNodeBinding(): NativeBinding {",
            `  return require(${JSON.stringify(addon)});`,
            "}",
          ].join("\n"),
        }));
      },
    },
  ],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

console.log(`${values.outfile}: ${target} with ${addon}`);
