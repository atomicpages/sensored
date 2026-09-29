# Logger Redaction

sensored provides adapters for popular Node.js logging libraries. These
adapters redact PII from structured log records before they're serialized
and written to transports — so sensitive data never leaves your process.

## Why redact at the logger boundary?

Log aggregation services (Datadog, Splunk, ELK) see everything you send
them. Once PII reaches a transport, it's too late. Redacting at the logger
formatter level ensures:

- PII is removed **before** serialization
- No changes to application code or log call sites
- Works with existing log pipelines and transports

## Pino

[`pino`](https://github.com/pinojs/pino) is a fast, low-overhead logger.
sensored's `pinoRedact` returns a Pino formatter configuration object.

### Install

```bash
bun add pino
```

### Usage

```ts
import pino from "pino";
import { pinoRedact } from "sensored/loggers/pino";

const logger = pino({
  ...pinoRedact({
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
    },
  }),
});

logger.info(
  {
    user: "John Smith",
    email: "john.smith@example.com",
    phone: "555-867-5309",
    event: "login",
  },
  "User logged in",
);
// Output: user is [PERSON_NAME_1], email is [EMAIL_1], phone is [PHONE_1]
```

### Sensitive field names

The adapter automatically redacts values at sensitive field names
regardless of content:

- `password`, `passwd`, `secret`, `token`, `authorization`, `auth`
- `cookie`, `api_key`, `apikey`, `api_secret`, `credential`, `credentials`
- `private_key`, `access_token`, `refresh_token`, `session`, `session_id`

```ts
logger.info(
  { authorization: "Bearer sk-abc123", event: "request" },
  "Incoming request",
);
// authorization is [REDACTED]
```

### detectOnly mode

Use `detectOnly: true` to log what PII *would* be redacted without
modifying the output — useful for validating rules before enabling
redaction in production.

## Winston

[`winston`](https://github.com/winstonjs/winston) is a versatile logger
with transports and formats. sensored's `winstonRedact` returns a
transform function for use with Winston's format system.

### Install

```bash
bun add winston
```

### Usage

```ts
import winston from "winston";
import { winstonRedact } from "sensored/loggers/winston";

const redact = winstonRedact({
  presets: ["pii"],
  rules: {
    person_name_lite: { action: "redact" },
    email: { action: "redact" },
    phone: { action: "redact" },
  },
});

const redactFormat = winston.format((info) => {
  Object.assign(info, redact(info));
  return info;
})();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat,
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

logger.info("User logged in", {
  user: "John Smith",
  email: "john.smith@example.com",
  phone: "555-867-5309",
});
// Output: user is [PERSON_NAME_1], email is [EMAIL_1], phone is [PHONE_1]
```

Place the redact format **before** the JSON formatter and all transports
so PII is removed before serialization.

## Morgan

[`morgan`](https://github.com/expressjs/morgan) is HTTP request logger
middleware for Express and Node.js. sensored's `morganRedact` wraps a
writable stream, redacting each formatted log line before it's written.

### Install

```bash
bun add morgan
```

### Usage

```ts
import http from "node:http";
import morgan from "morgan";
import { morganRedact } from "sensored/loggers/morgan";

const redactedStream = morganRedact(
  {
    presets: ["pii"],
    rules: {
      email: { action: "redact" },
      phone: { action: "redact" },
      ipv4: { action: "redact" },
    },
  },
  process.stdout,
);

morgan.format("sensored", ":method :url :status :remote-addr :user-agent");

const logger = morgan("sensored", { stream: redactedStream });

const server = http.createServer((req, res) => {
  logger(req, res, () => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hello!");
  });
});

server.listen(3000);
```

The stream wrapper can also be used standalone to redact any formatted
log line:

```ts
redactedStream.write(
  "GET /api/users/john.smith@example.com 200 192.168.1.100 Mozilla/5.0\n",
);
// Output: GET /api/users/[EMAIL_1] 200 [IPV4_1] Mozilla/5.0
```
