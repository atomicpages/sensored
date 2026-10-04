# sensored examples

## Setup

From the repo root, install example dependencies:

```bash
cd example
bun install
```

The examples import sensored via a tsconfig path alias (`sensored` → `../src/index.ts`),
so no build step is required.

## Directory structure

```
getting-started/   Quick-start examples — start here
llm/               LLM integration examples (OpenAI, Anthropic, sessions, semantic matching)
logging/           Logger adapter examples (Pino, Winston, Morgan, Bunyan, log4js, generic)
advanced/          Advanced patterns (custom detectors, file de-identification, NER)
server/            HTTP server middleware example
shared/            Shared utilities and sample data files
```

## getting-started/

### basic.ts

Streams an OpenAI completion through sensored's streaming redactor in real-time,
redacting PII as it arrives and printing a restoration map at the end.

```bash
OPENAI_API_KEY=sk-... bun run getting-started/basic.ts
```

### multiaction.ts

Multi-action redaction, custom detectors, allowlists, inspection, restoration,
and error handling. No API keys required.

```bash
bun run getting-started/multiaction.ts
```

## llm/

### openai.ts

Wrap an OpenAI client with `wrapOpenAI` so prompts are automatically redacted
and responses are automatically restored. Demonstrates both non-streaming and
streaming modes. Compare with `getting-started/basic.ts` which uses the
streaming redactor manually.

```bash
OPENAI_API_KEY=sk-... bun run llm/openai.ts
```

### anthropic.ts

Wrap an Anthropic client with `wrapAnthropic` so prompts are automatically
redacted and responses are automatically restored. Demonstrates both
non-streaming and streaming modes.

```bash
ANTHROPIC_API_KEY=sk-ant-... bun run llm/anthropic.ts
```

### session.ts

Persistent redaction across a multi-turn LLM conversation with dedup,
streaming, hydration, and reset using a real OpenAI model.

```bash
OPENAI_API_KEY=sk-... bun run llm/session.ts
```

### semantic-matching.ts

LLM steering via context hints and AI-powered semantic confirmation with Jev.
Requires both `OPENAI_API_KEY` and `TYPESAFE_API_KEY`.

```bash
OPENAI_API_KEY=sk-... TYPESAFE_API_KEY=... bun run llm/semantic-matching.ts
```

## logging/

### generic.ts

Redact PII from structured log output before writing to stdout. Includes a
drop-in logger wrapper. No API keys required.

```bash
bun run logging/generic.ts
```

### pino.ts

Redact PII from Pino log records using the `pinoRedact` adapter. Shows how to
plug sensored into Pino's formatter pipeline. No API keys required.

```bash
bun run logging/pino.ts
```

### winston.ts

Redact PII from Winston log records using the `winstonRedact` adapter. Shows
how to plug sensored into Winston's `format` pipeline. No API keys required.

```bash
bun run logging/winston.ts
```

### morgan.ts

Redact PII from Morgan HTTP access logs using the `morganRedact` adapter. Shows
how to wrap a writable stream so PII in URLs, IPs, and user agents is redacted
before writing. No API keys required.

```bash
bun run logging/morgan.ts
```

### bunyan.ts

Redact PII from raw bunyan log records using the `bunyanRedact` adapter. Shows
how to wrap a destination stream so PII in record fields is redacted before
JSON serialization and forwarding. No API keys required.

```bash
bun run logging/bunyan.ts
```

### log4js.ts

Redact PII from log4js log events using the sensored wrapper appender. Shows
how to configure a wrapper appender that redacts `loggingEvent.data` items
before delegating to the wrapped appender. No API keys required.

```bash
bun run logging/log4js.ts
```

## advanced/

### custom-detector.ts

Minimal isolated example of the `DetectorDefinition` extension contract:
pattern, context, stream metadata, validate, and context hint. No API keys
required.

```bash
bun run advanced/custom-detector.ts
```

### deidentify-file.ts

Reads a realistic clinical note (`shared/sample-clinical-note.txt`), strips PHI
using the HIPAA preset, and writes the de-identified document to
`shared/redacted-clinical-note.txt`. No API keys required.

```bash
bun run advanced/deidentify-file.ts
```

### ner-redaction.ts

Uses the compromise-powered `person_name` detector (NER) instead of the
lightweight `person_name_lite` (bloom filter) on the same clinical note.
Compares detection counts and shows false positives eliminated by NER.
Requires the `compromise` package (installed at the repo root). No API keys
required.

```bash
bun run advanced/ner-redaction.ts
```

## server/

### server.ts

HTTP echo server that redacts PII from request bodies using Bun's built-in
server. No API keys required.

```bash
bun run server/server.ts
# then:
curl -s localhost:3000/echo -d 'Contact John Smith at john.smith@example.com'
```
