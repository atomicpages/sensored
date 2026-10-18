/**
 * Golden fixture format (version 1).
 *
 * This file is the contract between the TS reference engine and every other
 * engine (Rust core, napi, Wasm). `generate.ts` writes these shapes; the Rust
 * tests read them. Change it only with a version bump.
 *
 * Conventions:
 * - Every offset is in UTF-16 code units, as in the public `Detection` type.
 *   Byte-oriented engines convert at the test boundary.
 * - `expected` is whatever the TS reference produced, verbatim. Fixtures
 *   record behaviour; they do not assert it is correct.
 * - Case ids are stable and unique within a file, so a failing case can be
 *   named in a bug report without quoting its input.
 */
import type { ErrorCode } from "../packages/sensored/src/errors";
import type {
  InspectionGroup,
  RestorationMap,
  RuleSetting,
} from "../packages/sensored/src/types";

export const GOLDEN_VERSION = 1;

/**
 * The JSON-only subset of `RedactorConfig`: what crosses the FFI boundary.
 *
 * Excluded because they hold functions or JS regexes, and stay in TS:
 * `detectors` (custom definitions) and `semantic`. `customHeaders` keeps only
 * its string form; `RegExp` entries are resolved on the TS side.
 */
export interface JsonRedactorConfig {
  readonly presets?: readonly string[];
  readonly customPresets?: Readonly<
    Record<string, Readonly<Record<string, RuleSetting | "off">>>
  >;
  readonly limits?: { readonly maxInputLength?: number };
  readonly rules: Readonly<Record<string, RuleSetting | "off">>;
  readonly restore?: boolean;
  readonly allowlist?: readonly string[];
  readonly detectOnly?: boolean;
  readonly detectorOptions?: {
    readonly http_auth_header?: {
      readonly customHeaders?: readonly string[];
    };
  };
}

export interface GoldenFile<Case> {
  readonly version: typeof GOLDEN_VERSION;
  readonly cases: readonly Case[];
}

/** `createRedactor(config).inspect(input)`; `map` is present when `config.restore`. */
export interface RenderCase {
  readonly id: string;
  readonly config: JsonRedactorConfig;
  readonly input: string;
  readonly expected: {
    readonly text: string;
    readonly groups: readonly InspectionGroup[];
    readonly map?: RestorationMap;
  };
}

/** `resolvePolicy(config).policy`: preset expansion and override merging. */
export interface PolicyCase {
  readonly id: string;
  readonly config: JsonRedactorConfig;
  readonly expected: { readonly policy: Readonly<Record<string, RuleSetting>> };
}

/**
 * A config or input the reference rejects. `config` is `unknown` on purpose:
 * malformed shapes are the point. When `input` is set, the error comes from
 * processing it, not from construction.
 */
export interface ErrorCase {
  readonly id: string;
  readonly config: unknown;
  readonly input?: string;
  readonly expected: { readonly code: ErrorCode; readonly path?: string };
}

/**
 * `redactor.stream(chunks, options)` normalised so one expectation holds for
 * every way of chunking `input`:
 * - `text` is all `text` events joined.
 * - `detections` is every `detection` event's group, in order, with absolute
 *   offsets.
 * - `map` is the `complete` event's map.
 *
 * Consumers must check `input` split at every code-point boundary into two
 * chunks, and split into one chunk per code point. The generator has already
 * verified that all of these chunkings agree.
 */
export interface StreamCase {
  readonly id: string;
  readonly config: JsonRedactorConfig;
  readonly options: { readonly report: boolean; readonly restore: boolean };
  readonly input: string;
  readonly expected: {
    readonly text: string;
    readonly detections: readonly InspectionGroup[];
    readonly map?: RestorationMap;
  };
}

/**
 * `restore(input, map)`. With `streamed: true`, consumers must also feed
 * `input` to a `StreamRestorer` at every code-point split and get the same
 * `expected` from the joined `push` and `flush` output.
 */
export interface RestoreCase {
  readonly id: string;
  readonly input: string;
  readonly map: RestorationMap;
  readonly streamed: boolean;
  readonly expected: string;
}

/**
 * Committed files under `golden/`. Inputs are hand-written and safe to push.
 *
 * Per-detector files (`golden/detectors/<ruleId>.json`, `RenderCase`s) are
 * derived from the eval corpus and are gitignored, because synthetic tokens
 * trip secret scanners (see `packages/sensored/eval/CONTEXT.md`). Their
 * SHA-256 digests live in the committed `golden/detectors.manifest.json`, so
 * a regenerated file that drifts fails the check.
 */
export interface GoldenFiles {
  readonly "render.json": GoldenFile<RenderCase>;
  readonly "offsets.json": GoldenFile<RenderCase>;
  readonly "presets.json": GoldenFile<RenderCase>;
  readonly "policy.json": GoldenFile<PolicyCase>;
  readonly "errors.json": GoldenFile<ErrorCase>;
  readonly "stream.json": GoldenFile<StreamCase>;
  readonly "restore.json": GoldenFile<RestoreCase>;
}

export interface DetectorManifest {
  readonly version: typeof GOLDEN_VERSION;
  /** SHA-256 of the `eval/corpus.json` the files were generated from. */
  readonly corpusFingerprint: string;
  readonly files: Readonly<
    Record<string, { readonly sha256: string; readonly cases: number }>
  >;
}
