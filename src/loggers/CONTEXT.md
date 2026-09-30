# Loggers

Logging library adapters that integrate sensored's redaction engine with
popular TypeScript logging frameworks.

## Files

- `bunyan.ts` — `bunyanRedact(config, stream)` returns a `BunyanRawStream`
  that intercepts raw bunyan log record objects, redacts PII via `redactValue`,
  JSON.stringifies the result, and forwards to the destination stream.
- `log4js.ts` — exports `configure(config, layouts, findAppender)`, a log4js
  wrapper appender that redacts PII in `loggingEvent.data` items (strings via
  `redactor.redact()`, objects via `redactValue()`) before delegating to the
  wrapped appender.
- `morgan.ts` — `morganRedact(config, stream)` returns a stream wrapper that
  redacts each formatted log line via `redactor.redact()` before writing to the
  target stream.
- `pino.ts` — `pinoRedact(config)` returns a Pino formatter object whose
  `log` function delegates to `createLogRedactor` from `../adapters/shared`.
- `winston.ts` — `winstonRedact(config)` returns a Winston transform function
  that delegates to `createLogRedactor` from `../adapters/shared`.

## Peer dependencies

Loggers accept formatter/stream objects as parameters and return wrapper
objects. No runtime imports of peer dependencies are needed — loggers operate
on the objects passed in. `pino`, `winston`, `morgan`, `bunyan`, and `log4js`
are not imported at all since their interfaces are structural.
