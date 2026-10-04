# Logger Redaction

sensored provides loggers for popular Node.js logging libraries. These loggers
redact PII from structured log records before they're serialized and written to
transports — so sensitive data never leaves your process.

## Why redact at the logger boundary?

Log aggregation services (Datadog, Splunk, ELK) see everything you send them.
Once PII reaches a transport, it's too late. Redacting at the logger formatter
level ensures:

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

The logger automatically redacts values at sensitive field names regardless of
content:

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

Use `detectOnly: true` to log what PII _would_ be redacted without modifying the
output — useful for validating rules before enabling redaction in production.

## Winston

[`winston`](https://github.com/winstonjs/winston) is a versatile logger with
transports and formats. sensored's `winstonRedact` returns a transform function
for use with Winston's format system.

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

Place the redact format **before** the JSON formatter and all transports so PII
is removed before serialization.

## Morgan

[`morgan`](https://github.com/expressjs/morgan) is HTTP request logger
middleware for Express and Node.js. sensored's `morganRedact` wraps a writable
stream, redacting each formatted log line before it's written.

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

The stream wrapper can also be used standalone to redact any formatted log line:

```ts
redactedStream.write(
  "GET /api/users/john.smith@example.com 200 192.168.1.100 Mozilla/5.0\n",
);
// Output: GET /api/users/[EMAIL_1] 200 [IPV4_1] Mozilla/5.0
```

## Bunyan

[`bunyan`](https://github.com/trentm/node-bunyan) is a fast JSON logger for
Node.js. sensored's `bunyanRedact` wraps a destination stream, intercepts raw
bunyan log record objects, redacts PII via `redactValue`, JSON.stringifies the
result, and forwards to the destination stream.

### Install

```bash
bun add bunyan
```

### Usage

```ts
import { bunyanRedact } from "sensored/loggers/bunyan";

const redactStream = bunyanRedact(
  {
    presets: ["pii"],
    rules: {
      person_name_lite: { action: "redact" },
      email: { action: "redact" },
      phone: { action: "redact" },
    },
  },
  process.stdout,
);

redactStream.write({
  msg: "User logged in",
  level: 30,
  user: "John Smith",
  email: "john.smith@example.com",
  phone: "555-867-5309",
  event: "login",
});
// Output: {"msg":"User logged in","level":30,"user":"[PERSON_NAME_1]","email":"[EMAIL_1]","phone":"[PHONE_1]","event":"login"}
```

The adapter returns a `BunyanRawStream` whose `write()` method accepts a raw
bunyan record object, redacts it, and forwards the JSON string to the
destination stream. It returns `true` per the bunyan raw stream convention.

## log4js

[`log4js`](https://github.com/log4js-node/log4js-node) is a port of the popular
log4j logging framework. sensored's log4js adapter is a wrapper appender that
redacts PII in `loggingEvent.data` items before delegating to the wrapped
appender.

### Install

```bash
bun add log4js
```

### Usage

```ts
import log4js from "log4js";
import { configure } from "sensored/loggers/log4js";

log4js.configure({
  appenders: {
    stdout: { type: "stdout" },
    redacted: {
      type: "sensored/loggers/log4js",
      appender: "stdout",
      redact: {
        presets: ["pii"],
        rules: {
          person_name_lite: { action: "redact" },
          email: { action: "redact" },
          phone: { action: "redact" },
        },
      },
    },
  },
  categories: {
    default: { appenders: ["redacted"], level: "info" },
  },
});

const logger = log4js.getLogger();

logger.info("User logged in", {
  user: "John Smith",
  email: "john.smith@example.com",
  phone: "555-867-5309",
});
// Output: User logged in { user: '[PERSON_NAME_1]', email: '[EMAIL_1]', phone: '[PHONE_1]' }
```

The wrapper appender resolves the wrapped appender via `findAppender` at call
time, redacts string args via `redactor.redact()` and object args via
`redactValue()`, creates a new event with the redacted data (no mutation), and
delegates to the wrapped appender.

## Console Wrapping

`wrapConsole` patches the global `console.*` methods so every argument is
redacted before output — useful for development, CLI tools, and any code that
logs directly to the console without a structured logger.

### Usage

```ts
import { wrapConsole } from "sensored/loggers/console";

const restore = wrapConsole({ presets: ["pii"], rules: {} });

console.log("Contact alice@example.com"); // → Contact [EMAIL_1]
console.info({ user: "John Smith", email: "john@example.com" });
// → { user: "[PERSON_NAME_1]", email: "[EMAIL_1]" }

restore();
console.log("Contact alice@example.com"); // → Contact alice@example.com
```

### restore()

`wrapConsole` returns a `restore()` function that reverts all patched methods
to their original implementations. Always call `restore()` when you're done —
or scope it with `try/finally` — to avoid leaving console methods patched in
long-running processes.

### Custom Console instances

By default, `wrapConsole` patches the global `console` object. Pass a second
argument to patch a custom `Console` instance instead:

```ts
import { wrapConsole } from "sensored/loggers/console";
import { Console } from "node:console";

const myConsole = new Console(process.stdout, process.stderr);
const restore = wrapConsole({ presets: ["pii"], rules: {} }, myConsole);

myConsole.log("Contact alice@example.com"); // → Contact [EMAIL_1]
restore();
```
