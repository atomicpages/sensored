/**
 * Packs and publishes every public workspace package whose version is not on
 * npm yet: `@sensored/native` first, then `sensored`, then the rest of
 * `packages/`. `bun pm pack` rewrites `workspace:*` to the exact version.
 * The `@sensored/native-<platform>` packages are published before this runs,
 * by `napi pre-publish` (see `.github/RELEASING.md`).
 *
 * Usage: bun scripts/publish.ts [--tag <dist-tag>] [--dry-run]
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { $ } from "bun";

const { values } = parseArgs({
  options: {
    tag: { type: "string", default: "latest" },
    "dry-run": { type: "boolean", default: false },
  },
});

const tag = values.tag;
const dryRun = values["dry-run"];

/** Publish order: dependencies before their dependents. */
const FIRST = ["crates/sensored-napi", "packages/sensored"];

const rest = readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join("packages", entry.name))
  .filter((dir) => !FIRST.includes(dir));

async function isPublished(name: string, version: string): Promise<boolean> {
  const view = await $`npm view ${`${name}@${version}`} version`
    .nothrow()
    .quiet();

  return view.exitCode === 0 && view.stdout.toString().trim() === version;
}

let published = 0;

for (const dir of [...FIRST, ...rest]) {
  const pkgJson = Bun.file(join(dir, "package.json"));

  if (!(await pkgJson.exists())) {
    continue;
  }

  const pkg = await pkgJson.json();

  if (pkg.private) {
    continue;
  }

  if (await isPublished(pkg.name, pkg.version)) {
    console.log(`${pkg.name}@${pkg.version} is already published; skipping.`);
    continue;
  }

  const access = pkg.publishConfig?.access ?? "public";
  console.log(
    `${dryRun ? "Dry-run publishing" : "Publishing"} ${pkg.name}@${pkg.version} (${tag})...`,
  );

  await $`bun pm pack`.cwd(dir);

  const tarball = `${pkg.name.replace(/^@/, "").replace(/\//g, "-")}-${pkg.version}.tgz`;
  // Provenance needs the CI's OIDC token, so a local dry run skips it.
  const flags = ["--access", access, "--tag", tag];

  flags.push(dryRun ? "--dry-run" : "--provenance");

  await $`npm publish ${tarball} ${flags}`.cwd(dir);
  await Bun.file(join(dir, tarball)).delete();
  published++;
}

console.log(
  `${dryRun ? "Dry-run published" : "Published"} ${published} package(s).`,
);
