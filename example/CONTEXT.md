# example/

Usage examples for the sensored PII redaction library. Each directory groups
examples by integration pattern.

## Structure

- `getting-started/` — Quick-start examples. Start here.
  - `basic.ts` — Streaming redaction with OpenAI.
  - `multiaction.ts` — Multi-action redaction, no API keys.

- `llm/` — LLM integration examples.
  - `openai.ts` — `wrapOpenAI` adapter.
  - `anthropic.ts` — `wrapAnthropic` adapter.
  - `session.ts` — Multi-turn conversation with dedup/hydration.
  - `semantic-matching.ts` — Jev semantic confirmation (OpenAI + Typesafe).

- `logging/` — Logger adapter examples.
  - `generic.ts` — Generic structured log redaction.
  - `pino.ts` — Pino adapter.
  - `winston.ts` — Winston adapter.
  - `morgan.ts` — Morgan HTTP access log adapter.
  - `bunyan.ts` — Bunyan adapter.
  - `log4js.ts` — log4js wrapper appender.
  - `console.ts` — Console method wrapping adapter.

- `advanced/` — Advanced patterns.
  - `custom-detector.ts` — `DetectorDefinition` extension contract.
  - `deidentify-file.ts` — HIPAA preset file de-identification.
  - `ner-redaction.ts` — Compromise NER vs bloom filter comparison.
  - `vault.ts` — Encrypted persistence for restoration maps (seal/open/hydrate).

- `server/` — HTTP server middleware.
  - `server.ts` — Bun HTTP echo server with PII redaction.

- `shared/` — Shared utilities and sample data.
  - `env.ts` — Environment variable validation (envalid). Imported by examples
    that need API keys.
  - `sample-clinical-note.txt` — Input clinical note for deidentify/NER examples.
  - `redacted-clinical-note.txt` — Output of deidentify-file.ts.
  - `redacted-clinical-note-ner.txt` — Output of ner-redaction.ts.

## Import paths

Examples import sensored via a tsconfig path alias (`sensored` → `../packages/sensored/src/index.ts`),
so no build step is required. Examples that need API keys import `env` from
`../shared/env`. Sample data files live in `shared/` and are referenced via
relative paths from the consuming example.

## Running

```bash
cd example
bun install
bun run <path-to-example>.ts
```

See `package.json` for convenience scripts (e.g. `bun run run:basic`).
