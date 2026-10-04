# Adapters

LLM client SDK adapters that integrate sensored's redaction engine with
popular AI provider libraries.

## Files

- `shared.ts` — `createSharedRedactor(rules, allowlist, options?)` returns a
  `SharedRedactor` with a single `RestorationContext` shared across all
  `redact()` calls. The same PII gets the same numbered placeholder within
  one logical request (e.g. one LLM API call). Exposes a `map` getter
  for restoration. Used by `openai.ts` and `anthropic.ts` adapters.
  Options: `dedup?: boolean` enables reverse-lookup deduplication (same
  original text → same placeholder across calls); `initialMap?: RestorationMap`
  hydrates the context from a previously stored map (parses placeholder keys
  to derive counters, skips malformed keys silently). `reset()` clears the
  context for reuse.
  Also exports `createLogRedactor(config)` — returns a
  `(obj: Record<string, unknown>) => Record<string, unknown>` function that
  creates a redactor and applies `redactValue` to structured objects. Used by
  `pino.ts` and `winston.ts` in `../loggers/` so redactor creation logic lives
  in one place.
  Also exports `SESSION_BRAND` (imported from `../symbols`),
  `RedactionAdapter` interface, and `isSession()` type guard — shared by
  `openai.ts` and `anthropic.ts` to discriminate `Session` from `RedactorConfig`
  in adapter overloads. `hydrateContext` uses `PLACEHOLDER_TEST` from
  `../placeholders` (non-global regex) for safe `.test()` calls without
  `lastIndex` management.
- `openai.ts` — `wrapOpenAI(client, config)` wraps an OpenAI client, redacting
  prompts and restoring responses (streaming and non-streaming). Also accepts
  a `Session` object (branded with `Symbol.for("sensored.session")`) instead of
  a config — uses `session.redact()` and `session.map` directly.
- `anthropic.ts` — `wrapAnthropic(client, config)` wraps an Anthropic client,
  redacting prompts and restoring responses (streaming and non-streaming). Also
  accepts a `Session` object instead of a config.

## Peer dependencies

Adapters accept client objects as parameters and return wrapper objects. No
runtime imports of peer dependencies are needed — adapters operate on the
objects passed in. Type-only imports are used where type annotations reference
peer dep types (e.g. `openai`, `@anthropic-ai/sdk`).

## Stream restoration

LLM adapters use `StreamRestorer` from `../stream-restore` to restore
placeholders in streaming responses, where a placeholder may be split across
chunk boundaries.
