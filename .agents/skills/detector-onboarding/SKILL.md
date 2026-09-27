---
name: detector-onboarding
description: "Step-by-step workflow for contributing a new detector to sensored. Covers the detector contract, stable IDs, context/validation, stream bounds, fixture generation, eval scoring, and maintainer review gates. Use when adding or onboarding a new detector."
---

# Detector onboarding

## 1. Overview

This skill guides a fresh contributor through adding a new detector to sensored.
It produces:

- A `DetectorDefinition` (custom detector) or a `Detector` subclass (built-in)
- Four fixture categories: positive, negative, boundary, adversarial
- Eval scores and a release-gate comparison with before/after evidence
- Documentation and a maintainer-review-ready contribution

All work uses Bun 1.4.2. No node.js APIs. No undocumented prerequisites.

## 2. Detector contract

The extension contract is defined by `DetectorDefinition` in `src/types.ts`:

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
}
```

### Required fields

| Field | Purpose |
| --- | --- |
| `id` | Stable lowercase snake_case identifier (e.g. `us_ssn`) |
| `entityType` | Semantic type label (e.g. `us_ssn`) |
| `replacement` | Redaction label in `[UPPER_SNAKE]` format (e.g. `[US_SSN]`) |
| `pattern` | RegExp that finds candidate spans |

### Optional fields

| Field | Purpose |
| --- | --- |
| `context` | UTF-16 code-unit window the validator can see (`before`, `after`) |
| `stream` | Finite stream metadata for streaming support |
| `validate` | Function that accepts or rejects a candidate, returning reason IDs or `false` |

### How `Detector` and `RegexDetector` work

The abstract `Detector` base class (`src/detectors.ts`) provides shared helpers:

- `filterGraphemeAligned(matches, text)` — drops matches that split grapheme clusters. Used by built-in detectors.
- `assertGraphemeAligned(matches, text)` — throws `DETECTOR_CONTRACT` if any match splits a grapheme cluster. Used by `RegexDetector` for custom detectors.
- `isAdjacentForbidden(text, start, end)` — returns `true` if the match is embedded in Unicode letters, marks, numbers, or `_`. Prevents matching identifiers inside larger words.

`RegexDetector` wraps a `DetectorDefinition`:

1. Snapshots the regex (strips `g`/`y` flags, compiles once).
2. Runs `text.matchAll(pattern)` to find candidates.
3. Rejects zero-width matches and matches exceeding `stream.maxMatchLength`.
4. Calls the optional `validate` function with the declared context window.
5. If `validate` returns `false`, the candidate is skipped.
6. If `validate` returns an array of reason strings, they must match `/^[a-zA-Z0-9_.-]+$/`.
7. Any throw from `validate` is caught and converted to `DETECTOR_CONTRACT` so caller values never leak.
8. Calls `assertGraphemeAligned` on all accepted matches — a contract violation, not a filter.

Built-in detectors extend `Detector` directly and implement custom `detect` logic. They use `filterGraphemeAligned` to drop misaligned matches rather than throwing.

### Grapheme alignment enforcement

All match start/end offsets must land on grapheme cluster boundaries. The `Intl.Segmenter` instance in `src/grapheme.ts` owns this logic. A match that splits a multi-code-point grapheme (e.g. an emoji with ZWJ, a base character with combining marks) is either filtered (built-ins) or causes a `DETECTOR_CONTRACT` error (custom detectors).

### Adjacent character checks

`isAdjacentForbidden` checks the character immediately before `start` and after `end` against `/[\p{L}\p{M}\p{N}_]/u`. If either side is a letter, mark, number, or underscore, the match is rejected. This prevents matching `123-45-6789` inside `my123-45-6789file`.

## 3. Stable IDs and metadata

### ID naming conventions

- Lowercase snake_case: `/^[a-z][a-z0-9_]*$/`
- Must start with a letter
- Examples: `us_ssn`, `payment_card`, `email`, `employee_id_example`

### entityType rules

- Non-empty string
- Typically matches the `id` for built-ins
- Can differ for custom detectors (e.g. `id: "employee_id_example"`, `entityType: "employee_id"`)

### Replacement label format

- `[UPPER_SNAKE_CASE]` — e.g. `[US_SSN]`, `[PAYMENT_CARD]`, `[EMAIL]`, `[EMPLOYEE_ID]`
- Users can override via `rules: { rule_id: { action: "redact", replacement: "[CUSTOM]" } }`

### Version stability commitments

Once a detector `id` is published, its matching behavior is a stability contract:
- The `id` never changes.
- The `entityType` never changes.
- The `replacement` never changes without a major version bump.
- The set of accepted/rejected candidates never shrinks without a documented behavior-change release note.
- Widening acceptance (finding more) is allowed; narrowing acceptance (finding fewer) requires explicit maintainer review and release notes.

## 4. Context and validation

### Writing a validator function

The `validate` function receives `{ value, before, after }`:

- `value` — the full matched text
- `before` — up to `context.before` UTF-16 code units preceding the match
- `after` — up to `context.after` UTF-16 code units following the match

Return `false` to reject the candidate. Return an array of reason strings to accept it. Reason strings must match `/^[a-zA-Z0-9_.-]+$/` and are included in inspection reports.

Example from `src/employee-id.ts`:

```ts
validate({ before }) {
  if (employeeIdLabelPattern.test(before)) {
    return ["employee_id_example.context"];
  }

  return false;
}
```

### Grapheme alignment requirements

The regex pattern must produce matches whose `start` and `end` positions land on grapheme cluster boundaries. If the pattern can match inside a multi-code-point grapheme (e.g. matching only the base character of a base+combining-mark sequence), `RegexDetector` will throw `DETECTOR_CONTRACT`.

To avoid this:
- Use Unicode-aware patterns (`/u` flag) where possible.
- Test against inputs containing emoji, ZWJ sequences, and combining marks.
- Use lookbehind/lookahead assertions (`(?<!...)`, `(?!...)`) to prevent matching inside grapheme clusters.

### When to reject candidates

Reject a candidate (return `false`) when:
- The match lacks required context (e.g. no qualifying label)
- The match fails structural validation (e.g. invalid checksum, wrong group sizes)
- The match is a substring of a longer valid candidate (e.g. extracting 16 digits from a 20-digit sequence)
- The match has invalid structure that the regex alone cannot exclude

## 5. Stream bounds

### When to declare stream metadata

Declare `stream` metadata when the detector's match length, context requirements, and boundary behavior are all finite and bounded. Without stream metadata, the detector cannot be used in streaming mode — `createStream` throws `STREAM_UNSUPPORTED` for any active rule lacking `stream`.

### Stream metadata fields

| Field | Description | How to calculate |
| --- | --- | --- |
| `maxMatchLength` | Maximum UTF-16 length of any accepted match | Longest possible match the pattern can produce, including separators |
| `leftContext` | UTF-16 units of preceding context the validator needs | Set to `context.before` (must be >= `context.before`) |
| `rightContext` | UTF-16 units of following context the validator needs | Set to `context.after` (must be >= `context.after`) |
| `boundaryLookaround` | Extra UTF-16 units for grapheme boundary safety | Typically `1` — enough to check one character on each side |

Example from `src/ssn.ts`:

```ts
override readonly stream = Object.freeze({
  maxMatchLength: 11,
  leftContext: 39,
  rightContext: 32,
  boundaryLookaround: 1,
});
```

### What happens when stream metadata is absent

`createStream` in `src/stream.ts` checks every active rule for `stream` metadata before processing the first chunk. If any rule lacks it, the function throws `STREAM_UNSUPPORTED` immediately — no chunks are consumed.

### The streaming buffering model

The streaming engine (`src/stream.ts`):

1. Accumulates chunks into a buffer (max 65,536 UTF-16 units).
2. Calculates a safe flush point: `buffer.length - maxMatchLength - max(leftContext, rightContext) - boundaryLookaround`.
3. Adjusts the flush point backward to the nearest grapheme boundary.
4. Runs detection on the full buffer.
5. Renders and emits only the safe portion via `renderSafePortion`.
6. Retains `maxLeftContext` units behind the consumed cursor for context-dependent detectors.
7. On source end, processes the remaining buffer fully.

This means: a detector with `maxMatchLength: 11`, `leftContext: 39`, `rightContext: 32`, `boundaryLookaround: 1` will hold back at least `11 + 39 + 1 = 51` UTF-16 units from the end of the buffer until more data arrives or the stream ends.

### Validation constraint

`validate.ts` enforces that `context.before <= stream.leftContext` and `context.after <= stream.rightContext`. The stream metadata context windows must be at least as large as the validator's declared context.

## 6. Fixture generation

Every detector contribution must include four fixture categories. Follow the patterns in `test/ssn.test.ts`, `test/payment-card.test.ts`, `test/email.test.ts`, and `test/employee-id.test.ts`.

### Positive fixtures

Valid matches that should be detected and redacted. Cover every accepted format variant, separator style, label variant, and context position.

```ts
test.each([
  ["SSN: 123-45-6789", "SSN: [US_SSN]"],
  ["SSN: 123456789", "SSN: [US_SSN]"],
  ["123-45-6789 (SSN)", "[US_SSN] (SSN)"],
])("%s", (input, expected) => {
  expect(redactor.redact(input)).toBe(expected);
  expect(redactor.inspect(input).text).toBe(expected);
});
```

### Negative fixtures

Near-misses that should NOT be detected. Cover structural failures, boundary violations, context mismatches, adjacency violations, and Unicode edge cases.

```ts
test.each([
  ["SSN: 000-45-6789", "first group 000"],
  ["Reference: 123-45-6789", "non-approved label"],
  ["123-45-6789", "no label"],
  ["SSN: 123-45-6789_", "underscore after candidate"],
  ["SSN: 123-45-6789\u0301", "combining mark after candidate"],
])("%s (%s)", (input) => {
  expect(redactor.redact(input)).toBe(input);
  expect(redactor.inspect(input).text).toBe(input);
});
```

### Boundary fixtures

Edge cases at the exact boundaries of valid/invalid. Test the minimum and maximum of every range, the last valid value, the first invalid value, and exact separator/spacing limits.

```ts
test("trailing period is preserved", () => {
  expect(redactor.redact("SSN: 123-45-6789.")).toBe("SSN: [US_SSN].");
});

test("9 spaces exceeds 0-8", () => {
  expect(redactor.redact("SSN:         123-45-6789")).toBe(
    "SSN:         123-45-6789",
  );
});
```

### Adversarial fixtures

Pathological inputs designed to break detection. Cover long sequences, Unicode edge cases, overlapping candidates, and inputs that could cause catastrophic backtracking.

```ts
test("long digit sequence is not substring-extracted", () => {
  expect(redactor.redact("0".repeat(100))).toBe("0".repeat(100));
});

test("emoji before candidate does not shift alignment", () => {
  expect(redactor.redact("\ud83d\ude00 SSN: 123-45-6789")).toBe(
    "\ud83d\ude00 SSN: [US_SSN]",
  );
});

test("overlapping candidates resolve correctly", () => {
  expect(redactor.redact("SSN: 123-45-6789 SSN: 234-56-7890")).toBe(
    "SSN: [US_SSN] SSN: [US_SSN]",
  );
});
```

### Fixture checklist

For each detector, verify coverage of:
- Every accepted format variant (hyphenated, compact, spaced)
- Every accepted label variant (case-insensitive, abbreviations)
- Every accepted context position (preceding, following)
- Every structural exclusion (invalid groups, bad checksums)
- Every adjacency violation (letters, digits, marks, underscores on both sides)
- Every Unicode edge case (surrogates, combining marks, ZWJ, emoji)
- Every boundary value (min/max digits, min/max spaces, last valid, first invalid)
- Coexistence with other detectors
- All three actions: redact, mask, remove
- Inspection spans and values use original UTF-16 offsets
- Policy is frozen

## 7. Eval workflow

The eval tooling lives in `eval/` and is development-only — never imported by the published library.

### Corpus schema

A corpus JSON file (from `eval/README.md`):

```json
{
  "revision": "synthetic-example-v1",
  "provenance": "synthetic",
  "reviewedBy": null,
  "rules": ["email"],
  "cases": [
    {
      "id": "case-001",
      "text": "a@example.com",
      "kind": "supported",
      "expected": [{"ruleId": "email", "start": 0, "end": 13}]
    },
    {"id": "case-002", "text": "ordinary text", "kind": "negative", "expected": []},
    {"id": "case-003", "text": "a@localhost", "kind": "deferred", "expected": []}
  ]
}
```

- Expected tuples use original UTF-16 offsets.
- Negative cases are ordinary-text documents with no expected detections.
- Deferred cases are counted separately and excluded from scoring.
- Case IDs and revisions are opaque ASCII identifiers — never put source text or identities in those fields.

### Commands

Score a corpus and write a report:

```sh
bun eval/cli.ts score /path/to/corpus.json /path/to/report.json
```

Compare against a baseline (release gate):

```sh
bun eval/cli.ts gate /path/to/corpus.json /path/to/after.json /path/to/before.json
```

- `score` writes scores and gate failures but exits successfully when scoring succeeds.
- `gate` exits 1 when any quality, data, or regression requirement fails.
- Both exit 2 on invalid data or execution failure.
- Output paths must be new files; existing reports are never overwritten.

### Trust boundary and review flow

- Implementer-authored fixtures do not count as held-out evaluation evidence.
- The independent corpus owner (Dennis, provisionally) must supply and review independently maintained data.
- Corpus provenance must be `independent` and `reviewedBy` set to an opaque reviewer ID only after real provenance/privacy and label review.
- Corpus revisions and approved baselines are kept in owner-controlled review history, separate from implementation fixtures.
- A changed corpus fingerprint blocks comparison: rerun the previous implementation on the new owner-reviewed corpus and approve a new baseline before comparing.

### Release gate requirements

The `releaseGate` function in `eval/evaluator.ts` checks:

1. Corpus is independently owner-reviewed (`independentReviewed`).
2. At least 1,000 negative documents.
3. Per launch detector: >=200 positive occurrences, >=99% precision, >=95% recall.
4. A reviewed baseline exists.
5. Corpus fingerprint matches the baseline (corpus unchanged).
6. No new FP or FN tuples, and no lost TP tuples against the baseline.

The gate rejects any newly introduced FP or FN tuple, or lost TP tuple, even if aggregate counts are unchanged. This prevents silently weakening expectations to pass.

## 8. Maintainer review gates

### Corpus changes require review

A changed corpus fingerprint blocks the gate. The maintainer must:
1. Rerun the previous implementation on the new owner-reviewed corpus.
2. Approve a new baseline.
3. Only then compare the new implementation.

Never auto-refresh baselines in CI.

### Behavior changes require release notes

Narrowing acceptance (finding fewer matches) is a behavior change that requires:
- A documented release note explaining what changed and why.
- Explicit maintainer review and approval.
- An acceptance-spec revision if numeric targets are affected.

### Expectations cannot be silently weakened to pass

The `releaseGate` function performs per-tuple regression checks:
- Any new FP tuple (false positive that wasn't in the baseline) blocks the gate.
- Any new FN tuple (false negative that wasn't in the baseline) blocks the gate.
- Any lost TP tuple (true positive that was in the baseline but is no longer detected) blocks the gate.

These checks are per-tuple, not per-count. You cannot compensate for a lost detection by adding a new one elsewhere.

### What to do when the gate fails

1. Read the `failures` array in the gate report — each failure names the specific case ID and regression type.
2. Fix the detector to restore the lost behavior.
3. If the regression is intentional, document it in a release note and seek maintainer approval.
4. Never delete or weaken corpus expectations to make the gate pass.

## 9. Reproducibility

A fresh contributor can follow this workflow end-to-end with no undocumented prerequisites:

```sh
git clone <repo>
cd sensored
bun install
```

### Step-by-step

1. **Read the contract** — Review `src/types.ts` (`DetectorDefinition`), `src/detectors.ts` (`Detector`, `RegexDetector`), and `src/employee-id.ts` (extension example).

2. **Write the detector** — Create a new file in `src/` (for built-ins) or a `DetectorDefinition` export (for custom detectors). Follow the patterns in `src/ssn.ts` or `src/employee-id.ts`.

3. **Register the detector** (built-ins only) — Add the singleton to `src/registry.ts`. Custom detectors are passed via `config.detectors` — no registry change needed.

4. **Write fixtures** — Create `test/<detector-name>.test.ts` with all four fixture categories. Run focused tests:

   ```sh
   bun test test/<detector-name>.test.ts
   ```

5. **Run full regression** — Ensure existing tests still pass:

   ```sh
   bun test
   ```

6. **Run typecheck** — Verify types are correct:

   ```sh
   bun run typecheck
   ```

7. **Run eval scoring** (if a corpus is available) — Score against the independent corpus:

   ```sh
   bun eval/cli.ts score /path/to/corpus.json /path/to/before.json
   ```

8. **Run eval gate** — Compare before/after to check for regressions:

   ```sh
   bun eval/cli.ts gate /path/to/corpus.json /path/to/after.json /path/to/before.json
   ```

9. **Document the detector** — Update `src/CONTEXT.md` if the detector changes the architecture. Add the detector to any relevant documentation.

10. **Submit for review** — Open a PR. The maintainer reviews corpus changes, behavior changes, and release notes. The release gate must pass.
