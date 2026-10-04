# Architecture Review Fixes Plan

**Date:** 2026-10-03  
**Status:** Pending approval

## Overview

Address 6 architecture review recommendations for the session subsystem.
All changes must preserve the existing 5063-test suite (green) and maintain
lint/typecheck cleanliness. No public API breaking changes.

---

## Recommendation 1: Drop Object.freeze from map getter (Strong)

**Problem:** `SharedRedactor.map` getter calls
`Object.freeze(Object.fromEntries(restoration.map.entries()))` on every access.
`Object.freeze` is the primary cost — it walks every property to set
non-writable/non-configurable descriptors, which is O(n) with a large
constant factor. `Object.fromEntries` is also O(n) but with a much smaller
constant (just property assignment). The OpenAI and Anthropic adapters call
`adapter.map` on every request, and `session.restore()` calls `shared.map`
on every call.

**Fix:** Drop `Object.freeze` everywhere it wraps `Object.fromEntries` in
the map getter paths. `RestorationMap = Readonly<Record<string, string>>`
already enforces immutability at the type level. `Object.fromEntries`
returns a fresh object — consumers can't mutate the internal `Map` through it.

**Files:** `src/adapters/shared.ts`, `src/engine.ts`

**Changes:**
1. In `src/adapters/shared.ts` `get map()`: replace
   `Object.freeze(Object.fromEntries(restoration.map.entries()))`
   with `Object.fromEntries(restoration.map.entries())`.
2. In `src/engine.ts:398` (`processText`): replace
   `Object.freeze(Object.fromEntries(restoration.map.entries()))`
   with `Object.fromEntries(restoration.map.entries())`.

**Regression risk:** None. `RestorationMap` is `Readonly<Record<string, string>>`
at the type level. The runtime object from `Object.fromEntries` is already a
fresh copy — consumers cannot reach into the internal `Map`. Dropping
`Object.freeze` only removes the redundant O(n) descriptor-walking overhead.

**Test:** No new tests needed. The existing 5063-test suite verifies map
correctness. Removing `Object.freeze` is a pure performance improvement
with no behavioral change.

---

## Recommendation 2: Extract SESSION_BRAND to a symbols module (Worth exploring)

**Problem:** `SESSION_BRAND = Symbol.for("sensored.session")` is defined in
both `src/session.ts:9` and `src/adapters/shared.ts:13`. Two definitions of
the same symbol constant is a DRY violation. They happen to be the same
(`Symbol.for` is idempotent), but the duplication is a maintenance hazard.

**Fix:** Create `src/symbols.ts` exporting `SESSION_BRAND`. Both `session.ts`
and `shared.ts` import from it.

**Files:** `src/symbols.ts` (new), `src/session.ts`, `src/adapters/shared.ts`

**Changes:**
1. Create `src/symbols.ts`:
   ```ts
   export const SESSION_BRAND = Symbol.for("sensored.session");
   ```
2. In `src/session.ts`: Remove `export const SESSION_BRAND = ...` line, add
   `import { SESSION_BRAND } from "./symbols";`. Re-export `SESSION_BRAND`
   from `session.ts` for backward compatibility (`export { SESSION_BRAND } from "./symbols";`).
3. In `src/adapters/shared.ts`: Remove `export const SESSION_BRAND = ...` line,
   add `import { SESSION_BRAND } from "../symbols";`. Re-export for backward
   compatibility (`export { SESSION_BRAND } from "../symbols";`).

**Regression risk:** None. `Symbol.for` is idempotent so the runtime value
is identical. Re-exports preserve the public API surface. Any consumer
importing `SESSION_BRAND` from `session` or `adapters/shared` still works.

**Context updates:** Update `src/CONTEXT.md` to mention `symbols.ts`.
Update `src/adapters/CONTEXT.md` to note `SESSION_BRAND` is now imported
from `../symbols`.

---

## Recommendation 3: Resolve PLACEHOLDER_PATTERN collision and /g flag landmine (Strong)

**Problem:** Two different regexes share the name `PLACEHOLDER_PATTERN`:
- `src/placeholders.ts:1`: `/\[[A-Z][A-Z0-9_]*_\d+\]/g` — matches numbered
  placeholders like `[EMAIL_1]`. Used by `restore.ts` for `String.replace`.
- `src/engine.ts:31`: `/\[[A-Z][A-Z0-9_]*\]/g` — matches broader placeholder
  spans including `[REDACTED]` and unnumbered `[EMAIL]`. Used by
  `findPlaceholderSpans` for idempotency filtering via `matchAll`.

Both have the `/g` flag. `RegExp.test()` on a `/g` regex is stateful
(`lastIndex` advances), which is a landmine if anyone calls `.test()` on
these patterns. Currently `shared.ts:39` does `PLACEHOLDER_PATTERN.lastIndex = 0`
before `.test()` — this works but is fragile.

**Fix:**
1. Rename the engine's pattern to `REDACT_SPAN_PATTERN` (it finds spans of
   already-redacted text, which is semantically what it does).
2. Keep `PLACEHOLDER_PATTERN` in `placeholders.ts` as-is (it's the public
   one used by `restore.ts`).
3. In `engine.ts`, replace `PLACEHOLDER_PATTERN` with `REDACT_SPAN_PATTERN`.
4. In `shared.ts`, `hydrateContext` uses `PLACEHOLDER_PATTERN` from
   `placeholders.ts` for `.test()` — add a non-global companion pattern
   `PLACEHOLDER_TEST` (without `/g`) to `placeholders.ts` and use it
   in `hydrateContext` instead. This eliminates the `lastIndex = 0` hack.

**Files:** `src/placeholders.ts`, `src/engine.ts`, `src/adapters/shared.ts`

**Changes:**
1. `src/placeholders.ts` — add:
   ```ts
   export const PLACEHOLDER_TEST = /\[[A-Z][A-Z0-9_]*_\d+\]/;
   ```
   (Same regex as `PLACEHOLDER_PATTERN` but without `/g` — safe for `.test()`.)
2. `src/engine.ts` — rename the local `PLACEHOLDER_PATTERN` to
   `REDACT_SPAN_PATTERN`. Update all references in `findPlaceholderSpans`.
3. `src/adapters/shared.ts` — import `PLACEHOLDER_TEST` instead of
   `PLACEHOLDER_PATTERN`. In `hydrateContext`, replace:
   ```ts
   PLACEHOLDER_PATTERN.lastIndex = 0;
   if (!PLACEHOLDER_PATTERN.test(placeholder)) {
   ```
   with:
   ```ts
   if (!PLACEHOLDER_TEST.test(placeholder)) {
   ```

**Regression risk:** None. `matchAll` on a `/g` regex is correct and
unaffected by the rename. `PLACEHOLDER_TEST` is a new export — no existing
code changes behavior. The `lastIndex = 0` hack is removed, eliminating a
class of bugs.

**Context updates:** Update `src/CONTEXT.md` to mention `PLACEHOLDER_TEST`
in the `placeholders.ts` description.

---

## Recommendation 4: Deepen session.ts by absorbing SharedRedactor (Speculative)

**Problem:** `session.ts` is a thin pass-through to `SharedRedactor`.
`SharedRedactor` exists solely to serve `session.ts` (and the adapter
`createSharedRedactor` path used by `openai.ts`/`anthropic.ts` when passed
a `RedactorConfig` instead of a `Session`). The `redact()` method in
`session.ts` just delegates to `shared.redact()`, and `shared.ts` has
the actual logic.

**Fix:** Move the `SharedRedactor` logic (redact, map getter, reset)
directly into `session.ts`. `createSharedRedactor` remains in `shared.ts`
for the adapter path (openai/anthropic creating a one-off redactor from
config), but it becomes a simpler wrapper that doesn't need `reset()` or
`initialMap` — just `redact` and `map`.

**Wait — this is speculative.** The adapters DO use `createSharedRedactor`
directly when given a `RedactorConfig`. And `SharedRedactor` has `reset()`
which the adapters don't use. Absorbing would mean either:
- (a) Duplicating the redact logic in both `session.ts` and `shared.ts`, or
- (b) Having `session.ts` call `createSharedRedactor` internally (which it
  already does).

The current design already has `session.ts` leveraging `createSharedRedactor`.
The thinness is intentional — `session.ts` adds the `Session` brand,
`redactMessages`, `restore`, `stream`, and `reset` semantics on top of the
shared redactor primitive. This is good separation of concerns.

**Decision: Skip this recommendation.** The module boundary is correct.
`SharedRedactor` is a reusable primitive; `Session` is a domain object with
additional semantics. Absorbing would reduce the module's depth by
conflating two responsibilities. No changes needed.

---

## Recommendation 5: Deduplicate detectAndRender and collectMatches in engine.ts (Worth exploring)

**Problem:** `detectAndRender` (engine.ts:350-356) inlines the same
`rules.flatMap → findPlaceholderSpans → filterPlaceholderMatches → filterAllowlist`
pipeline that `collectMatches` (engine.ts:290-297) already encapsulates.
`collectMatches` was extracted for the async semantic flow, but
`detectAndRender` was not updated to call it.

**Fix:** `detectAndRender` calls `collectMatches` instead of inlining the
pipeline.

**Files:** `src/engine.ts`

**Changes:**
Replace lines 350-356 in `detectAndRender`:
```ts
const matches = rules.flatMap((rule) =>
  rule.detector.detect(text).map((detection) => ({ detection, rule })),
);

const placeholders = findPlaceholderSpans(text);
const filtered = filterPlaceholderMatches(matches, placeholders);
const allowlisted = filterAllowlisted(filtered, allowlist, text);
```
with:
```ts
const allowlisted = collectMatches(text, rules, allowlist);
```

**Regression risk:** None. `collectMatches` performs the exact same
operations in the exact same order. The intermediate variables
(`matches`, `placeholders`, `filtered`) were not used after the pipeline
in `detectAndRender` — only `allowlisted` is passed to `renderSafePortion`.

**Test:** Existing tests cover this via `processText` (which calls
`detectAndRender`) and `createSharedRedactor` (which calls `collectMatches`).
No new tests needed — the 5063-test suite is sufficient verification.

---

## Recommendation 6: Preserve hydration map across reset() (Worth exploring)

**Problem:** `session.ts:62-64` — `reset()` creates a fresh `SharedRedactor`
without passing `initialMap`. After a reset, the hydration map from session
creation is lost. A session created with an existing map, when reset, loses
that initial state.

**Fix:** Store `existingMap` in closure scope and pass it on reset.

**Files:** `src/session.ts`

**Changes:**
1. Capture `existingMap` in the closure (already available as a parameter).
2. Pass it to `createSharedRedactor` in `reset()`:
   ```ts
   reset(): void {
     shared = createSharedRedactor(rules, allowlist, {
       dedup: true,
       initialMap: existingMap,
     });
   },
   ```

**Regression risk:** Low. The existing `reset()` test (line 76-87 in
`test/session.test.ts`) creates a session without `existingMap`, so
`existingMap` is `undefined` — `createSharedRedactor` already handles
`undefined` initialMap (skips hydration). Sessions created WITH an
`existingMap` will now preserve that map across resets, which is the
expected behavior.

**Test:** Add test in `test/session.test.ts`:
- Create session with `existingMap`, call `reset()`, verify the initial
  map entries are restored and numbering continues from the hydrated
  counters.

---

## Execution Order

Execute in this order to minimize merge conflicts and maximize test
verification at each step:

1. **Rec 2** (symbols.ts) — standalone, no dependencies
2. **Rec 1** (drop Object.freeze) — touches shared.ts and engine.ts
3. **Rec 3** (PLACEHOLDER_PATTERN rename) — touches engine + placeholders + shared
4. **Rec 5** (dedup detectAndRender) — touches engine only
5. **Rec 6** (preserve hydration map) — touches session.ts (already modified in Rec 2)
6. **Rec 4** — SKIP (no changes needed)

After each step: `bun test`, `bun run lint`, `bun run typecheck`.

## Context Updates

After all code changes:
- Update `src/CONTEXT.md` — add `symbols.ts` to file list, update
  `placeholders.ts` description to mention `PLACEHOLDER_TEST`, update
  `engine.ts` description to mention `REDACT_SPAN_PATTERN`.
- Update `src/adapters/CONTEXT.md` — note `SESSION_BRAND` is now imported
  from `../symbols`.

## Test Additions

1 new test in `test/session.test.ts`:
1. reset() preserves hydration map from session creation (Rec 6)

## Verification

```bash
bun test          # 5063 + 1 new = 5064 tests, all passing
bun run lint      # clean
bun run typecheck # clean
```
