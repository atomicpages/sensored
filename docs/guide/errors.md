# Errors

sensored uses a single error class — `SensoredError` — with a `code` field
that identifies the specific error type. All error messages are library-defined
and contain no caller-supplied values, making them safe to expose.

## Error codes

| Code | Default HTTP Status | Description |
|---|---|---|
| `INVALID_CONFIG` | 400 | Configuration or input has an invalid shape |
| `UNKNOWN_RULE` | 400 | Configuration contains an unknown rule or preset |
| `EMPTY_POLICY` | 400 | No rules are enabled |
| `INPUT_LIMIT` | 413 | Input exceeds the complete-string limit |
| `POLICY_CONFLICT` | 409 | Presets contain conflicting rule settings |
| `STREAM_UNSUPPORTED` | 400 | One or more active rules don't support streaming |
| `BUFFER_LIMIT` | 413 | Streaming buffer exceeded the configured limit |
| `DETECTOR_CONTRACT` | 500 | A detector violated its declared contract |
| `SOURCE_FAILURE` | 424 | The stream source produced an error |
| `CANCELLED` | 499 | The operation was cancelled |

## SensoredError

```ts
class SensoredError extends Error {
  readonly code: ErrorCode;
  readonly path?: string;
  readonly info?: Readonly<Record<string, unknown>>;
}
```

- **code** — One of the error codes listed above
- **path** — Optional configuration path where the error occurred (e.g.,
  `"presets"`, `"rules"`, `"detectors"`)
- **info** — Optional structured metadata (e.g., available preset versions)

## Handling errors

```ts
import { createRedactor, SensoredError } from "sensored";

try {
  const redactor = createRedactor({ presets: ["unknown"], rules: {} });
} catch (error) {
  if (error instanceof SensoredError) {
    console.log(error.code);   // "UNKNOWN_RULE"
    console.log(error.message); // "Configuration contains an unknown rule."
    console.log(error.path);    // "presets"
  }
}
```

## RFC 9457 Problem Details

`SensoredError.toProblemDetails()` serializes to an RFC 9457 Problem Details
object. You can provide a custom status map to override default HTTP statuses:

```ts
import { SensoredError } from "sensored";

const error = new SensoredError("INPUT_LIMIT");
const problem = error.toProblemDetails();

// {
//   type: "urn:sensored:error:input_limit",
//   title: "INPUT_LIMIT",
//   status: 413,
//   detail: "Input exceeds the complete-string limit.",
//   code: "INPUT_LIMIT"
// }
```

Custom status map:

```ts
const problem = error.toProblemDetails({
  INPUT_LIMIT: 400,
});
// problem.status === 400
```

::: warning
Supplied status mappings must respect the only-500-in-5xx rule. Any 5xx
status other than 500 will throw an error.
:::

## ProblemDetails interface

```ts
interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: ErrorCode;
  readonly path?: string;
  readonly [key: string]: unknown;
}
```

The `type` field is a URN in the format `urn:sensored:error:{code}`.
