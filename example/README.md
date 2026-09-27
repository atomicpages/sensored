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
