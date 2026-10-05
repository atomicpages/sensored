import { SensoredError } from "../errors";
import { graphemeAlignedEndpoints } from "../grapheme";
import type { SemanticQuestion } from "../semantic/types";
import type { ContextHint, Detection, DetectorDefinition } from "../types";

const forbiddenAdjacent = /[\p{L}\p{M}\p{N}_]/u;

// ---------------------------------------------------------------------------
// Stream metadata helper
// ---------------------------------------------------------------------------

/**
 * Create a frozen stream metadata object for a context-based detector.
 *
 * Standalone so any detector (not just `ContextDetector` subclasses) can
 * reuse the same shape.
 */
export function streamMeta(
  maxMatchLength: number,
  leftContext: number,
  rightContext: number,
): NonNullable<DetectorDefinition["stream"]> {
  return Object.freeze({
    maxMatchLength,
    leftContext,
    rightContext,
    boundaryLookaround: 1,
  });
}

// ---------------------------------------------------------------------------
// Reason validation
// ---------------------------------------------------------------------------

/** Reasons must be non-empty strings matching a safe identifier pattern. */
function validateReasons(reasons: unknown): reasons is readonly string[] {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return false;
  }

  return reasons.every(
    (reason) => typeof reason === "string" && /^[a-zA-Z0-9_.-]+$/.test(reason),
  );
}

// ---------------------------------------------------------------------------
// Abstract base class
// ---------------------------------------------------------------------------

/**
 * Abstract base for all detectors.
 *
 * Built-in detectors extend this class and implement custom `detect` logic.
 * Custom (user-supplied) detectors are wrapped by `RegexDetector`.
 *
 * Shared helpers:
 * - `filterGraphemeAligned` — drop matches that split grapheme clusters
 * - `assertGraphemeAligned` — throw if any match splits a grapheme cluster
 * - `isAdjacentForbidden` — check if a match is embedded in word characters
 */
export abstract class Detector {
  abstract readonly id: string;
  abstract readonly entityType: string;
  abstract readonly replacement: string;
  readonly stream?: DetectorDefinition["stream"];

  get contextHint(): ContextHint | undefined {
    return undefined;
  }

  abstract detect(text: string): Detection[];

  semanticConfirm?(_candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }): SemanticQuestion | undefined;

  /**
   * Collect the subset of match endpoints that are grapheme-aligned.
   *
   * Only the match endpoints (not every position in the text) are checked,
   * avoiding O(n) memory for large inputs.  ASCII endpoints are resolved
   * in O(1); non-ASCII endpoints fall back to a single segmenter pass.
   */
  private collectAlignedEndpoints(
    matches: Detection[],
    text: string,
  ): Set<number> {
    const endpoints: number[] = [];

    for (const { start, end } of matches) {
      endpoints.push(start, end);
    }

    return graphemeAlignedEndpoints(text, endpoints);
  }

  /**
   * Drop matches whose start/end don't land on grapheme boundaries.
   *
   * Used by built-in detectors that may produce candidates splitting
   * multi-code-point graphemes (e.g. emoji, combining marks).
   */
  protected filterGraphemeAligned(
    matches: Detection[],
    text: string,
  ): Detection[] {
    if (matches.length === 0) {
      return matches;
    }

    const aligned = this.collectAlignedEndpoints(matches, text);

    return matches.filter(
      ({ start, end }) => aligned.has(start) && aligned.has(end),
    );
  }

  /**
   * Throw if any match start/end doesn't land on a grapheme boundary.
   *
   * Used by `RegexDetector` for custom detectors — a contract violation
   * rather than a filter, since the regex is user-supplied.
   */
  protected assertGraphemeAligned(matches: Detection[], text: string): void {
    if (matches.length === 0) {
      return;
    }

    const aligned = this.collectAlignedEndpoints(matches, text);

    const allAligned = matches.every(
      ({ start, end }) => aligned.has(start) && aligned.has(end),
    );

    if (!allAligned) {
      throw new SensoredError("DETECTOR_CONTRACT");
    }
  }

  /**
   * Check whether a match is embedded in Unicode letters, marks, numbers, or _.
   *
   * Prevents matching identifiers like "123-45-6789" inside a larger word.
   * Handles surrogate pairs when checking the previous character.
   */
  protected isAdjacentForbidden(
    text: string,
    start: number,
    end: number,
  ): boolean {
    if (this.isStartForbidden(text, start)) {
      return true;
    }

    return this.isEndForbidden(text, end);
  }

  protected isStartForbidden(text: string, start: number): boolean {
    if (start > 0) {
      const previous = text.charCodeAt(start - 1);

      const width =
        previous >= 0xdc00 && previous <= 0xdfff && start > 1 ? 2 : 1;

      if (forbiddenAdjacent.test(text.slice(start - width, start))) {
        return true;
      }
    }

    return false;
  }

  protected isEndForbidden(text: string, end: number): boolean {
    if (end < text.length) {
      const point = text.codePointAt(end);

      if (point !== undefined) {
        const character = String.fromCodePoint(point);

        if (forbiddenAdjacent.test(character)) {
          return true;
        }
      }
    }

    return false;
  }
}

export function createContextMatcher(
  labels: string,
  leftContext: number,
  rightContext: number,
) {
  const precedingPattern = new RegExp(
    `(?:^|[^\\p{L}\\p{M}\\p{N}_])${labels}[ \\t]{0,8}[:#]?[ \\t]{0,8}$`,
    "iu",
  );

  const followingPattern = new RegExp(`^[ \\t]{1,8}\\(${labels}\\)`, "iu");

  const followingNoParenPattern = new RegExp(
    `^[ \\t]{1,8}${labels}(?:[^\\p{L}\\p{M}\\p{N}_]|$)`,
    "iu",
  );

  function hasPrecedingContext(text: string, start: number): boolean {
    const before = text.slice(Math.max(0, start - leftContext), start);
    return precedingPattern.test(before);
  }

  function hasFollowingContext(text: string, end: number): boolean {
    const after = text.slice(end, end + rightContext);
    return followingPattern.test(after) || followingNoParenPattern.test(after);
  }

  function hasContext(text: string, start: number, end: number): boolean {
    return hasPrecedingContext(text, start) || hasFollowingContext(text, end);
  }

  return { hasPrecedingContext, hasFollowingContext, hasContext };
}

// ---------------------------------------------------------------------------
// ContextDetector — shared pipeline for context-matching detectors
// ---------------------------------------------------------------------------

/**
 * Abstract base for detectors that share the context-matching pipeline:
 * matchAll → adjacency check → optional validate → hasContext → push → filterGraphemeAligned.
 *
 * Subclasses provide a `pattern`, `contextLabels`, and context window sizes.
 * They may optionally override `validate()` for domain-specific checks.
 */
export abstract class ContextDetector extends Detector {
  protected abstract readonly pattern: RegExp;
  protected abstract readonly contextLabels: string;
  protected abstract readonly labelStrings: readonly string[];
  protected abstract readonly leftContext: number;
  protected abstract readonly rightContext: number;

  #contextHint: ContextHint | undefined;

  override get contextHint(): ContextHint | undefined {
    if (this.#contextHint === undefined) {
      this.#contextHint = Object.freeze({
        required: true,
        labels: Object.freeze([...this.labelStrings]),
        position: "both" as const,
        window: Object.freeze({
          before: this.leftContext,
          after: this.rightContext,
        }),
      });
    }

    return this.#contextHint;
  }

  #contextMatcher: ReturnType<typeof createContextMatcher> | undefined;

  protected get contextMatcher() {
    if (this.#contextMatcher === undefined) {
      this.#contextMatcher = createContextMatcher(
        this.contextLabels,
        this.leftContext,
        this.rightContext,
      );
    }

    return this.#contextMatcher;
  }

  /**
   * Optional domain-specific validation.
   * Return `false` to reject a candidate, or a reasons array to accept it.
   * Defaults to returning a single format reason.
   */
  protected validate(_candidate: string): false | readonly string[] {
    return [`${this.id}.format`];
  }

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(this.pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      const candidate = match[0];

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      const reasons = this.validate(candidate);

      if (reasons === false) {
        continue;
      }

      if (!this.contextMatcher.hasContext(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: this.id,
        entityType: this.entityType,
        reasons: [...reasons, `${this.id}.context`],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

// ---------------------------------------------------------------------------
// KeywordDetector — shared pipeline for keyword-proximity detectors
// ---------------------------------------------------------------------------

/**
 * Abstract base for detectors that require a keyword to appear within a
 * bounded window of the match.  Subclasses provide a `pattern` and a list
 * of `keywords`.  The detect pipeline runs matchAll → adjacency check →
 * keyword-proximity check → filterGraphemeAligned.
 */
export abstract class KeywordDetector extends Detector {
  protected abstract readonly pattern: RegExp;
  protected abstract readonly keywords: readonly string[];
  protected readonly keywordWindow = 40;

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];
    const globalPattern = new RegExp(
      this.pattern.source,
      `${this.pattern.flags.replace(/g/g, "")}g`,
    );

    for (const match of text.matchAll(globalPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      const before = text
        .slice(Math.max(0, start - this.keywordWindow), start)
        .toLowerCase();
      const after = text.slice(end, end + this.keywordWindow).toLowerCase();
      const window = before + after;

      const hasKeyword = this.keywords.some((keyword) =>
        window.includes(keyword.toLowerCase()),
      );

      if (!hasKeyword) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: this.id,
        entityType: this.entityType,
        reasons: [`${this.id}.format`, `${this.id}.keyword`],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

// ---------------------------------------------------------------------------
// RegexDetector — wraps a DetectorDefinition
// ---------------------------------------------------------------------------

/**
 * Detector backed by a user-supplied `DetectorDefinition`.
 *
 * Snapshots the regex source/flags and runs an optional custom validator.
 * Any validator throw or contract violation is converted to a
 * `DETECTOR_CONTRACT` error so caller values never leak.
 */
export class RegexDetector extends Detector {
  readonly id: string;
  readonly entityType: string;
  readonly replacement: string;

  override readonly stream?: DetectorDefinition["stream"];

  readonly #pattern: RegExp;
  readonly #before: number;
  readonly #after: number;
  readonly #maxLength: number | undefined;
  readonly #validate: DetectorDefinition["validate"];
  readonly #contextHint: ContextHint | undefined;
  readonly #semanticConfirm: DetectorDefinition["semanticConfirm"];

  constructor(definition: DetectorDefinition) {
    super();

    this.id = definition.id;
    this.entityType = definition.entityType;
    this.replacement = definition.replacement;
    this.stream = definition.stream
      ? Object.freeze({ ...definition.stream })
      : undefined;

    // Snapshot the regex so the caller can't mutate it later.
    // Strip global and sticky flags — we add our own global flag for matchAll.
    // Compile once instead of per detect() call.
    this.#pattern = new RegExp(
      definition.pattern.source,
      `${definition.pattern.flags.replace(/[gy]/g, "")}g`,
    );

    this.#before = definition.context?.before ?? 0;
    this.#after = definition.context?.after ?? 0;
    this.#maxLength = definition.stream?.maxMatchLength;
    this.#validate = definition.validate;
    this.#semanticConfirm = definition.semanticConfirm;

    if (definition.contextHint !== undefined) {
      const hint = definition.contextHint;

      this.#contextHint = Object.freeze({
        required: true,
        labels: Object.freeze(hint.labels ? [...hint.labels] : []),
        position: hint.position ?? "both",
        window: Object.freeze({
          before: this.#before,
          after: this.#after,
        }),
        ...(hint.instructions !== undefined
          ? { instructions: hint.instructions }
          : {}),
      });
    } else {
      this.#contextHint = undefined;
    }
  }

  override get contextHint(): ContextHint | undefined {
    return this.#contextHint;
  }

  override semanticConfirm(candidate: {
    readonly value: string;
    readonly before: string;
    readonly after: string;
  }): SemanticQuestion | undefined {
    return this.#semanticConfirm?.(candidate);
  }

  override detect(text: string): Detection[] {
    const matches: Detection[] = [];

    this.#pattern.lastIndex = 0;

    for (const match of text.matchAll(this.#pattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (end === start) {
        throw new SensoredError("DETECTOR_CONTRACT");
      }

      if (this.#maxLength !== undefined && end - start > this.#maxLength) {
        throw new SensoredError("DETECTOR_CONTRACT");
      }

      const reasons = this.#validate
        ? this.#validate({
            value: match[0],
            before: text.slice(Math.max(0, start - this.#before), start),
            after: text.slice(end, end + this.#after),
          })
        : ["detector.pattern"];

      if (reasons === false) {
        continue;
      }

      if (!validateReasons(reasons)) {
        throw new SensoredError("DETECTOR_CONTRACT");
      }

      matches.push({
        start,
        end,
        ruleId: this.id,
        entityType: this.entityType,
        reasons: [...reasons],
      });
    }

    // Custom detectors must produce grapheme-aligned matches — throw, not filter.
    this.assertGraphemeAligned(matches, text);

    return matches;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a Detector from a user-supplied DetectorDefinition. */
export function registerDetector(definition: DetectorDefinition): Detector {
  return new RegexDetector(definition);
}
