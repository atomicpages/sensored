/**
 * Browser smoke: serves the package over HTTP and runs the shared checks in
 * headless Chromium through the Wasm URL entry (the `browser` condition).
 * Uses Playwright's Chromium when installed (`bunx playwright-core install
 * chromium`), else the local Chrome.
 *
 * Usage: bun scripts/ci/smoke-browser.ts (after `bun run build`)
 */
import { join } from "node:path";
import { chromium } from "playwright-core";

declare global {
  interface Window {
    result: Promise<{ ok: boolean; out: string }>;
  }
}

const ROOT = join(import.meta.dir, "..", "..");

const PAGE = `<!doctype html>
<script type="module">
  import * as sensored from "/dist/src/index.wasm-url.mjs";
  import { smoke } from "/scripts/ci/smoke-checks.mjs";

  window.result = smoke(sensored).then(
    (out) => ({ ok: true, out }),
    (error) => ({ ok: false, out: String(error) }),
  );
</script>`;

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/") {
      return new Response(PAGE, { headers: { "content-type": "text/html" } });
    }

    const file = Bun.file(join(ROOT, pathname));

    return (await file.exists())
      ? new Response(file)
      : new Response("not found", { status: 404 });
  },
});

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

const browser = await launch();

try {
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.url.href);
  await page.waitForFunction(() => "result" in window);

  const result = await page.evaluate(() => window.result);

  if (!result.ok || errors.length > 0) {
    throw new Error(`Browser smoke failed: ${result.out} ${errors.join("; ")}`);
  }

  console.log("Browser smoke (wasm): OK", result.out);
} finally {
  await browser.close();
  server.stop();
}
