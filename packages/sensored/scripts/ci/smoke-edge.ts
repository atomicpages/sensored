/**
 * Static check: nothing the browser and edge entries import (transitively)
 * pulls in a `node:` module. Node-only files (the napi entry, the sync Wasm
 * loader, the vault) may use them; they are simply not reachable from here.
 *
 * Usage: bun scripts/ci/smoke-edge.ts (after `bun run build`)
 */
import { dirname, join, relative } from "node:path";

const DIST = join(import.meta.dir, "..", "..", "dist", "src");
const ENTRIES = ["index.wasm-url.mjs", "index.wasm-module.mjs"];
const SPECIFIER = /(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g;

const seen = new Set<string>();
const offenders: string[] = [];
const queue = ENTRIES.map((entry) => join(DIST, entry));

while (queue.length > 0) {
  const file = queue.pop();

  if (file === undefined || seen.has(file)) {
    continue;
  }

  seen.add(file);

  for (const [, specifier] of (await Bun.file(file).text()).matchAll(
    SPECIFIER,
  )) {
    if (specifier === undefined) {
      continue;
    }

    if (specifier.startsWith("node:")) {
      offenders.push(`${relative(DIST, file)} imports ${specifier}`);
    } else if (specifier.startsWith(".") && specifier.endsWith(".mjs")) {
      queue.push(join(dirname(file), specifier));
    }
  }
}

if (offenders.length > 0) {
  console.error(
    `Edge/browser entries reach node: modules:\n  ${offenders.join("\n  ")}`,
  );
  process.exit(1);
}

console.log(
  `Edge smoke: OK (${seen.size} modules reachable from ${ENTRIES.join(", ")}, no node: imports)`,
);
