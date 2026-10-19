/**
 * The `--engine ts|napi|wasm` switch shared by `bench/` and `eval/`: which
 * engine `createRedactor` runs on. `ts` is the reference (`src/reference.ts`);
 * `napi` and `wasm` set the binding the public API runs on.
 */
import { createRequire } from "node:module";
import { createRedactor } from "../src/api.ts";
import { setBinding } from "../src/native/binding.ts";
import { loadWasmSync } from "../src/native/wasm-sync.ts";
import { createRedactor as createReference } from "../src/reference.ts";

const ENGINES = ["ts", "napi", "wasm"] as const;

export type EngineName = (typeof ENGINES)[number];

function isEngine(value: string | undefined): value is EngineName {
  return ENGINES.some((engine) => engine === value);
}

/** Splits `--engine <name>` (default `napi`) out of `args`. */
export function takeEngine(args: readonly string[]): {
  engine: EngineName;
  rest: string[];
} {
  const index = args.indexOf("--engine");

  if (index === -1) {
    return { engine: "napi", rest: [...args] };
  }

  const engine = args[index + 1];

  if (!isEngine(engine)) {
    throw new Error(`--engine must be one of: ${ENGINES.join(", ")}`);
  }

  return {
    engine,
    rest: [...args.slice(0, index), ...args.slice(index + 2)],
  };
}

/** `createRedactor` on `engine`. Sessions always run on the binding. */
export function useEngine(engine: EngineName): typeof createRedactor {
  if (engine === "ts") {
    return createReference;
  }

  if (engine === "wasm") {
    setBinding(loadWasmSync());
  } else {
    const napi: typeof import("@sensored/native") = createRequire(
      import.meta.url,
    )("@sensored/native");

    setBinding(napi);
  }

  return createRedactor;
}
