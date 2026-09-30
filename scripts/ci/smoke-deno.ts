import { createRedactor } from "./dist/src/index.mjs";

const r = createRedactor({
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const out = r.redact("Contact alice@example.com or call 555-123-4567");

if (!out.includes("[EMAIL")) {
  throw new Error("email not redacted");
}
if (!out.includes("[PHONE")) {
  throw new Error("phone not redacted");
}

console.log("Deno smoke: OK", out);
