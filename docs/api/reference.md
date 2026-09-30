# API Reference

## createRedactor

Creates an immutable redactor instance. The redactor is frozen and cannot be
modified after creation.

```ts
function createRedactor(
  config: RedactorConfig & { restore: true },
): RedactorWithRestore;
function createRedactor(config: RedactorConfig): RedactorWithoutRestore;
```

TypeScript overloads ensure that when `restore: true` is set, `redact()` returns
`RedactResult` (`{ text, map }`); otherwise it returns a plain `string`.

### Parameters

- **config**: `RedactorConfig` — See [Configuration](../guide/configuration)

### Returns

A frozen redactor object with `redact()`, `inspect()`, `stream()`, `restore()`,
and `policy` properties.

### Example

```ts
import { createRedactor } from "sensored";

const redactor = createRedactor({ presets: ["pii"], rules: {} });
```

---

## Redactor methods

### redact

Redacts sensitive data from the input text.

```ts
// Without restore
redact(text: string): string

// With restore
redact(text: string): RedactResult
```

Throws `INPUT_LIMIT` if the text exceeds `maxInputLength`.

### redactAsync

Async variant of `redact()` that runs semantic confirmation on detected PII
candidates before redacting. Requires `semantic` config. See
[AI Confirmation](../guide/semantic-confirmation) for details.

```ts
redactAsync(text: string): Promise<AsyncRedactResult>
```

Throws `INPUT_LIMIT` if the text exceeds `maxInputLength`.

### inspect

Inspects the input text and returns detections without transforming it.

```ts
inspect(text: string): Inspection
```

Returns the original text plus an array of `InspectionGroup` objects with match
details including values, offsets, and reasons.

### stream

Creates an async iterable that redacts a stream of text chunks.

```ts
stream(
  chunks: AsyncIterable<string>,
  options?: StreamOptions,
): AsyncIterable<StreamEvent>
```

Throws `STREAM_UNSUPPORTED` if any active rule's detector lacks stream metadata.

### restore

Restores redacted text to its original form using a restoration map.

```ts
restore(text: string, map: RestorationMap): string
```

### policy

The frozen, resolved policy object mapping rule IDs to their `RuleSetting`.

```ts
readonly policy: Readonly<Record<string, RuleSetting>>
```

### describe

Returns descriptions of the detectors active in this redactor's resolved policy.
Each description includes an optional `contextHint` for context-dependent
detectors. See [LLM Steering](../guide/llm-steering).

```ts
describe(): readonly DetectorDescription[]
```

---

## Types

### RedactorConfig

```ts
interface RedactorConfig {
  presets?: readonly string[];
  customPresets?: Readonly<
    Record<string, Readonly<Record<string, RuleSetting | "off">>>
  >;
  limits?: { maxInputLength?: number };
  rules: Readonly<Record<string, RuleSetting | "off">>;
  detectors?: readonly DetectorDefinition[];
  restore?: boolean;
  allowlist?: readonly string[];
  readonly semantic?: SemanticConfig;
}
```

### SemanticConfig

```ts
interface SemanticConfig {
  readonly provider: "jev";
  readonly apiKey: string;
  readonly model?: string;
  readonly thresholds?: Readonly<Record<string, number>>;
  readonly contextWindow?: number;
}
```

### RuleSetting

```ts
type RuleSetting =
  RedactRule | FormatPreserveRule | TokenReplaceRule | MaskRule | RemoveRule;
```

### RedactRule

```ts
interface RedactRule {
  readonly action: "redact";
  readonly replacement?: string;
  readonly priority?: number;
}
```

### MaskRule

```ts
interface MaskRule {
  readonly action: "mask";
  readonly preserve?: { readonly first?: number; readonly last?: number };
}
```

### RemoveRule

```ts
interface RemoveRule {
  readonly action: "remove";
}
```

### FormatPreserveRule

```ts
interface FormatPreserveRule {
  readonly action: "format-preserve";
}
```

### TokenReplaceRule

```ts
interface TokenReplaceRule {
  readonly action: "token-replace";
  readonly tokens?: Readonly<Record<string, string>>;
}
```

### RedactResult

```ts
interface RedactResult {
  readonly text: string;
  readonly map: RestorationMap;
}
```

### AsyncRedactResult

```ts
interface AsyncRedactResult {
  readonly text: string;
  readonly map?: RestorationMap;
  readonly detections: readonly SemanticDetection[];
  readonly warnings?: readonly string[];
}
```

### SemanticDetection

```ts
interface SemanticDetection extends Detection {
  readonly semanticConfirmed: boolean;
  readonly noul?: number;
}
```

### RestorationMap

```ts
type RestorationMap = Readonly<Record<string, string>>;
```

### DetectorDefinition

```ts
interface DetectorDefinition {
  readonly id: string;
  readonly entityType: string;
  readonly replacement: string;
  readonly pattern: RegExp;
  readonly context?: { readonly before: number; readonly after: number };
  readonly stream?: {
    readonly maxMatchLength: number;
    readonly leftContext: number;
    readonly rightContext: number;
    readonly boundaryLookaround: number;
  };
  readonly validate?: (candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }) => false | readonly string[];
  readonly contextHint?: {
    readonly labels?: readonly string[];
    readonly position?: "preceding" | "following" | "both";
    readonly instructions?: string;
  };
  readonly semanticConfirm?: (candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }) => SemanticQuestion;
}
```

### SemanticQuestion

```ts
interface SemanticQuestion {
  readonly instructions:
    | string
    | {
        readonly task: string;
        readonly candidate: string;
        readonly before?: string;
        readonly after?: string;
      };
  readonly criteria?: {
    readonly true: string;
    readonly false: string;
  };
}
```

### ContextHint

Describes the context labels a detector requires. Returned by `listDetectors()`
and `redactor.describe()`.

```ts
interface ContextHint {
  readonly required: boolean;
  readonly labels: readonly string[];
  readonly position: "preceding" | "following" | "both";
  readonly window: { readonly before: number; readonly after: number };
  readonly instructions?: string;
}
```

### DetectorDescription

A frozen description of a detector, returned by `listDetectors()` and
`redactor.describe()`.

```ts
interface DetectorDescription {
  readonly id: string;
  readonly entityType: string;
  readonly replacement: string;
  readonly stream: boolean;
  readonly contextHint?: ContextHint;
}
```

### Inspection

```ts
interface Inspection {
  readonly text: string;
  readonly groups: readonly InspectionGroup[];
}
```

### InspectionGroup

```ts
interface InspectionGroup {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  readonly matches: readonly InspectedMatch[];
}
```

### InspectedMatch

```ts
interface InspectedMatch extends Detection {
  readonly value: string;
}
```

### Detection

```ts
interface Detection {
  readonly start: number;
  readonly end: number;
  readonly ruleId: string;
  readonly entityType: string;
  readonly reasons: readonly string[];
}
```

### StreamOptions

```ts
interface StreamOptions {
  readonly signal?: AbortSignal;
  readonly report?: boolean;
  readonly restore?: boolean;
}
```

### StreamEvent

```ts
type StreamEvent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "detection"; readonly group: InspectionGroup }
  | { readonly type: "complete"; readonly map?: RestorationMap };
```

---

## Errors

### SensoredError

```ts
class SensoredError extends Error {
  readonly code: ErrorCode;
  readonly path?: string;
  readonly info?: Readonly<Record<string, unknown>>;

  toProblemDetails(
    statusMap?: Partial<Record<ErrorCode, number>>,
  ): ProblemDetails;
}
```

### ErrorCode

```ts
type ErrorCode =
  | "INVALID_CONFIG"
  | "UNKNOWN_RULE"
  | "EMPTY_POLICY"
  | "INPUT_LIMIT"
  | "DETECTOR_CONTRACT"
  | "POLICY_CONFLICT"
  | "STREAM_UNSUPPORTED"
  | "BUFFER_LIMIT"
  | "SOURCE_FAILURE"
  | "CANCELLED";
```

### ProblemDetails

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

See [Errors](../guide/errors) for the full error reference with default HTTP
statuses.

---

## Standalone functions

### listDetectors

Returns descriptions of all 129 built-in detectors, including their context
hints. See [LLM Steering](../guide/llm-steering).

```ts
import { listDetectors } from "sensored";

function listDetectors(): readonly DetectorDescription[];
```

### preloadPersonNameDetector

Loads the optional `compromise` dependency for the `person_name` NER detector.
Concurrent and repeated calls share one import.

```ts
import { preloadPersonNameDetector } from "sensored";

function preloadPersonNameDetector(): Promise<void>;

await preloadPersonNameDetector();
```

### restore

Restores redacted text using a restoration map. Can be used without a redactor
instance.

```ts
import { restore } from "sensored";

function restore(text: string, map: RestorationMap): string;
```

---

## Constants

### MAX_INPUT_LENGTH

The default maximum input length in UTF-16 code units.

```ts
const MAX_INPUT_LENGTH: 1_048_576; // 1 MiB
```

---

## Exports

```ts
// Factory
export { createRedactor };

// Standalone functions
export { listDetectors };
export { preloadPersonNameDetector };
export { restore };

// Error class and types
export { SensoredError };
export type { ErrorCode, ProblemDetails };

// Detector base class (for advanced custom detectors)
export { Detector };

// Example detector
export { employeeIdExample };

// Type exports
export type {
  AsyncRedactResult,
  ContextHint,
  Detection,
  DetectorDescription,
  DetectorDefinition,
  FormatPreserveRule,
  InspectedMatch,
  Inspection,
  InspectionGroup,
  MaskRule,
  RedactorConfig,
  RedactResult,
  RedactRule,
  RemoveRule,
  RestorationMap,
  RuleSetting,
  SemanticCandidate,
  SemanticConfig,
  SemanticDetection,
  SemanticQuestion,
  SemanticResult,
  StreamEvent,
  StreamOptions,
  TokenReplaceRule,
};

// Constants
export { MAX_INPUT_LENGTH };
```
