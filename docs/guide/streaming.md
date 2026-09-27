# Streaming

sensored is built streaming-first. The streaming engine processes continuous
text streams without buffering the entire input, making it suitable for
real-time pipelines, large files, and network sources.

## Basic streaming

```ts
const redactor = createRedactor({ presets: ["pii"], rules: {} });

async function* asyncChunks() {
  yield "Contact me at john@";
  yield "example.com for details.";
}

const stream = redactor.stream(asyncChunks());
for await (const event of stream) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }
}
// Output: "Contact me at [EMAIL_1] for details."
```

## StreamEvent

The stream yields three event types:

```ts
type StreamEvent =
  | { type: "text"; text: string }
  | { type: "detection"; group: InspectionGroup }
  | { type: "complete"; map?: RestorationMap };
```

### text

Redacted text segments. Concatenate these to build the full output.

### detection

An `InspectionGroup` with absolute offsets into the original stream. Only
emitted when `report: true` is set in `StreamOptions`.

```ts
const stream = redactor.stream(asyncChunks(), { report: true });
for await (const event of stream) {
  if (event.type === "detection") {
    console.log(event.group.start, event.group.end, event.group.replacement);
  }
}
```

### complete

Emitted once at the end of the stream. When restoration is enabled, includes
the `RestorationMap`:

```ts
const stream = redactor.stream(asyncChunks(), { restore: true });
for await (const event of stream) {
  if (event.type === "complete") {
    console.log(event.map);
    // { "[EMAIL_1]": "john@example.com" }
  }
}
```

## StreamOptions

```ts
interface StreamOptions {
  signal?: AbortSignal;
  report?: boolean;
  restore?: boolean;
}
```

### signal

An `AbortSignal` to cancel the stream. If aborted, a `CANCELLED` error is
thrown. The stream checks the signal between chunks.

```ts
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

const stream = redactor.stream(asyncChunks(), { signal: controller.signal });
```

### report

When `true`, detection events are emitted with `InspectionGroup` data
containing absolute offsets and match details.

### restore

When `true`, the complete event includes a `RestorationMap`. This is separate
from the `config.restore` setting — you can use restoration in streaming mode
independently.

## How it works

The streaming engine:

1. **Buffers** incoming chunks into an internal buffer
2. **Calculates safe flush points** based on each detector's stream metadata
   (maxMatchLength, context windows, boundary lookaround)
3. **Adjusts for grapheme clusters** to avoid splitting multi-codepoint
   characters
4. **Calls the detection engine** on the safe portion up to the flush point
5. **Emits** redacted text and optional detection events
6. **Retains** context behind the flush point for detectors that need lookbehind

## Limitations

- **Buffer limit**: The internal buffer is capped at 65,536 UTF-16 code units.
  If the buffer exceeds this (e.g., a single chunk larger than 64 KiB with no
  flush point), a `BUFFER_LIMIT` error is thrown.
- **Stream metadata required**: Every active detector must declare `stream`
  metadata. If any active rule lacks stream support, a `STREAM_UNSUPPORTED`
  error is thrown at stream creation time.
- **Source errors**: If the async iterable throws, it's wrapped in a
  `SOURCE_FAILURE` error.
