# sensored examples

## Setup

From the repo root, install example dependencies:

```bash
cd example
bun install
```

The examples import sensored via a tsconfig path alias (`sensored` → `../src/index.ts`),
so no build step is required.

## basic.ts

Streams an OpenAI completion through sensored's streaming redactor in real-time,
redacting PII as it arrives and printing a restoration map at the end.

```bash
OPENAI_API_KEY=sk-... bun run basic.ts
```

## multiaction.ts

Multi-action redaction, custom detectors, allowlists, inspection, restoration,
and error handling. No API keys required.

```bash
bun run multiaction.ts
```

## semantic-llm.ts

LLM steering via context hints and AI-powered semantic confirmation with Jev.
Requires both `OPENAI_API_KEY` and `TYPESAFE_API_KEY`.

```bash
OPENAI_API_KEY=sk-... TYPESAFE_API_KEY=... bun run semantic-llm.ts
```

## logging.ts

Redact PII from structured log output before writing to stdout. Includes a
drop-in logger wrapper. No API keys required.

```bash
bun run logging.ts
```

## pino-logging.ts

Redact PII from Pino log records using the `pinoRedact` adapter. Shows how to
plug sensored into Pino's formatter pipeline. No API keys required.

```bash
bun run pino-logging.ts
```

## winston-logging.ts

Redact PII from Winston log records using the `winstonRedact` adapter. Shows
how to plug sensored into Winston's `format` pipeline. No API keys required.

```bash
bun run winston-logging.ts
```

## morgan-logging.ts

Redact PII from Morgan HTTP access logs using the `morganRedact` adapter. Shows
how to wrap a writable stream so PII in URLs, IPs, and user agents is redacted
before writing. No API keys required.

```bash
bun run morgan-logging.ts
```

## openai-wrapper.ts

Wrap an OpenAI client with `wrapOpenAI` so prompts are automatically redacted
and responses are automatically restored. Demonstrates both non-streaming and
streaming modes. Compare with `basic.ts` which uses the streaming redactor
manually.

```bash
OPENAI_API_KEY=sk-... bun run openai-wrapper.ts
```

## anthropic-wrapper.ts

Wrap an Anthropic client with `wrapAnthropic` so prompts are automatically
redacted and responses are automatically restored. Demonstrates both
non-streaming and streaming modes.

```bash
ANTHROPIC_API_KEY=sk-ant-... bun run anthropic-wrapper.ts
```

## server.ts

HTTP echo server that redacts PII from request bodies using Bun's built-in
server. No API keys required.

```bash
bun run server.ts
# then:
curl -s localhost:3000/echo -d 'Contact John Smith at john.smith@example.com'
```

## custom-detector.ts

Minimal isolated example of the `DetectorDefinition` extension contract:
pattern, context, stream metadata, validate, and context hint. No API keys
required.

```bash
bun run custom-detector.ts
```

## deidentify-file.ts

Reads a realistic clinical note (`sample-clinical-note.txt`), strips PHI
using the HIPAA preset, and writes the de-identified document to
`redacted-clinical-note.txt`. No API keys required.

```bash
bun run deidentify-file.ts
```

## ner-redaction.ts

Uses the compromise-powered `person_name` detector (NER) instead of the
lightweight `person_name_lite` (bloom filter) on the same clinical note.
Compares detection counts and shows false positives eliminated by NER.
Requires the `compromise` package (installed at the repo root). No API keys
required.

```bash
bun run ner-redaction.ts
```
