/**
 * Server example: HTTP middleware that redacts PII from request bodies
 * before processing.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run server.ts
 *
 * Then test with:
 *   curl -s localhost:3000/echo -d 'Contact John Smith at john.smith@example.com or 555-867-5309'
 */

import { createRedactor } from "sensored";

const redactor = createRedactor({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
    us_ssn: { action: "format-preserve" },
    payment_card: { action: "token-replace" },
    postal_code: "off",
  },
  restore: true,
});

const html = `<!DOCTYPE html>
<html>
<body>
  <h1>sensored echo server</h1>
  <p>POST to /echo with a body containing PII — you'll get the redacted text back.</p>
  <form method="POST" action="/echo">
    <textarea name="body" rows="5" cols="60" placeholder="Enter text with PII..."></textarea>
    <br><button type="submit">Send</button>
  </form>
</body>
</html>`;

const server = Bun.serve({
  port: 3000,

  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (req.method === "POST" && url.pathname === "/echo") {
      const body = await req.text();

      const { text: redacted, map } = redactor.redact(body);

      return Response.json(
        {
          original: body,
          redacted,
          restorationMap: map,
          detections: Object.keys(map).length,
        },
        { status: 200 },
      );
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(
  `sensored echo server listening on http://localhost:${server.port}`,
);
