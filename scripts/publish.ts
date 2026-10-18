import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const dryRun = process.argv.includes("--dry-run");

let published = 0;

for (const entry of readdirSync("packages", { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const pkgPath = join("packages", entry.name);
  const pkgJsonPath = join(pkgPath, "package.json");

  if (!(await Bun.file(pkgJsonPath).exists())) {
    continue;
  }

  const pkg = JSON.parse(await Bun.file(pkgJsonPath).text());

  if (pkg.private) {
    continue;
  }

  const access = pkg.publishConfig?.access ?? "public";
  const action = dryRun ? "Dry-run publishing" : "Packing and publishing";
  console.log(`${action} ${pkg.name}@${pkg.version}...`);

  await $`cd ${pkgPath} && bun pm pack`;

  const tarballName = `${pkg.name.replace(/^@/, "").replace(/\//g, "-")}-${pkg.version}.tgz`;
  const tarballPath = join(pkgPath, tarballName);

  if (dryRun) {
    await $`npm publish ${tarballPath} --access ${access} --provenance --dry-run`;
  } else {
    await $`npm publish ${tarballPath} --access ${access} --provenance`;
  }

  await Bun.file(tarballPath).delete();
  published++;
}

if (published > 0) {
  console.log(
    `${dryRun ? "Dry-run published" : "Published"} ${published} package(s).`,
  );
} else {
  console.log("No packages published.");
}
