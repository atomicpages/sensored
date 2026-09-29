# Adapters

Framework-specific adapters that integrate sensored's redaction engine with
popular logging libraries and LLM client SDKs.

## Files

- `shared.ts` — `createSharedRedactor(rules, allowlist)` returns a
  `SharedRedactor` with a single `RestorationContext` shared across all
  `redact()` calls. The same PII gets the same numbered placeholder within
  one logical request (e.g. one LLM API call). Exposes a frozen `map` getter
  for restoration. Used by `openai.ts` and `anthropic.ts` adapters.
  Also exports `createLogRedactor(config)` — returns a
  `(obj: Record<string, unknown>) => Record<string, unknown>` function that
  creates a redactor and applies `redactValue` to structured objects. Used by
  `pino.ts` and `winston.ts` so redactor creation logic lives in one place.
- `pino.ts` — `pinoRedact(config)` returns a Pino formatter object whose
  `log` function delegates to `createLogRedactor`.
- `winston.ts` — `winstonRedact(config)` returns a Winston transform function
  that delegates to `createLogRedactor`.
- `openai.ts` — `wrapOpenAI(client, config)` wraps an OpenAI client, redacting
  prompts and restoring responses (streaming and non-streaming).
- `anthropic.ts` — `wrapAnthropic(client, config)` wraps an Anthropic client,
  redacting prompts and restoring responses (streaming and non-streaming).
- `morgan.ts` — `morganRedact(config, stream)` returns a stream wrapper that
  redacts each formatted log line via `redactor.redact()` before writing to the
  target stream.

## Peer dependencies

Adapters accept client/formatter/stream objects as parameters and return
wrapper objects. No runtime imports of peer dependencies are needed —
adapters operate on the objects passed in. Type-only imports are used where
type annotations reference peer dep types (e.g. `openai`, `@anthropic-ai/sdk`),
but `pino`, `winston`, and `morgan` are not imported at all since their
interfaces are structural.

## Stream restoration

LLM adapters use `StreamRestorer` from `../stream-restore` to restore
placeholders in streaming responses, where a placeholder may be split across
chunk boundaries.
