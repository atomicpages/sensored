/**
 * Morgan logging example: redact PII from HTTP access logs using the
 * sensored morgan adapter.
 *
 * No API keys required.
 *
 * Usage:
 *   bun run morgan-logging.ts
 */

import http from "node:http";
import morgan from "morgan";
import { type MorganStream, morganRedact } from "sensored/loggers/morgan";

const redactedStream: MorganStream = morganRedact(
  {
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
      ipv4: { action: "redact" },
    },
  },
  process.stdout,
);

morgan.format("sensored", ":method :url :status :remote-addr :user-agent");

const logger = morgan("sensored", { stream: redactedStream });

console.log("--- Stream wrapper demo ---\n");

redactedStream.write(
  "GET /api/users/john.smith@example.com 200 192.168.1.100 Mozilla/5.0\n",
);
redactedStream.write("POST /api/contact 201 10.0.0.5 curl/8.0\n");
redactedStream.write(
  "GET /api/phone/555-867-5309 404 172.16.0.1 PostmanRuntime/7.36\n",
);

console.log("\n--- HTTP server with morgan middleware ---\n");

const server = http.createServer((req, res) => {
  logger(req, res, () => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello from sensored + morgan!");
  });
});

server.listen(3001, () => {
  console.log("Morgan logger running on http://localhost:3001");
  console.log("Try: curl -s localhost:3001/api/users/john@example.com");
});
