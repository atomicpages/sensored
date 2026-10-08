import { resolveReplacement, resolveWinningAction } from "./render";
import type {
  ActiveRule,
  AuditAction,
  Detection,
  Inspection,
  InspectionGroup,
  RestorationMap,
} from "./types";

export interface AppliedMatch {
  detection: Detection;
  rule: ActiveRule;
}

export interface RenderedSegment {
  readonly text: string;
  readonly group?: InspectionGroup;
}

// ---------------------------------------------------------------------------
// Placeholder filtering (idempotency)
// ---------------------------------------------------------------------------

/**
 * Pattern for redaction output placeholders: `[EMAIL]`, `[PAYMENT_CARD]`,
 * `[US_SSN]`, numbered variants `[EMAIL_1]`, and the fallback `[REDACTED]`.
 *
 * Filtering detections that overlap these spans ensures redacting
 * already-redacted text is a no-op.
 */
const REDACT_SPAN_PATTERN = /\[[A-Z][A-Z0-9_]*\]/g;

/** Find spans of placeholder text in the input. */
function findPlaceholderSpans(
  text: string,
): readonly { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];

  for (const match of text.matchAll(REDACT_SPAN_PATTERN)) {
    if (match.index !== undefined) {
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return spans;
}

/**
 * Drop matches that overlap any placeholder span.
 *
 * A match overlaps if its start is before the placeholder's end
 * and its end is after the placeholder's start.
 */
function filterPlaceholderMatches(
  matches: AppliedMatch[],
  placeholders: readonly { start: number; end: number }[],
): AppliedMatch[] {
  if (placeholders.length === 0) {
    return matches;
  }

  return matches.filter(({ detection }) => {
    for (const { start, end } of placeholders) {
      if (detection.start < end && detection.end > start) {
        return false;
      }
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Match sorting
// ---------------------------------------------------------------------------

/** Sort by start, then end, then ruleId for deterministic ordering. */
function compareMatches(a: AppliedMatch, b: AppliedMatch): number {
  if (a.detection.start !== b.detection.start) {
    return a.detection.start - b.detection.start;
  }

  if (a.detection.end !== b.detection.end) {
    return a.detection.end - b.detection.end;
  }

  if (a.detection.ruleId < b.detection.ruleId) {
    return -1;
  }

  if (a.detection.ruleId > b.detection.ruleId) {
    return 1;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Overlap grouping
// ---------------------------------------------------------------------------

interface MatchGroup {
  contributors: AppliedMatch[];
  start: number;
  end: number;
}

/**
 * Group matches whose spans transitively overlap.
 *
 * Sorted matches are walked left-to-right; any match whose start falls
 * inside the growing group extent joins the group and extends it.
 * Adjacent (touching but non-overlapping) matches stay separate.
 */
function groupOverlappingMatches(matches: AppliedMatch[]): MatchGroup[] {
  const groups: MatchGroup[] = [];
  let index = 0;

  while (index < matches.length) {
    const first = matches[index];

    if (!first) {
      break;
    }

    const contributors: AppliedMatch[] = [first];
    const start = first.detection.start;
    let end = first.detection.end;
    index++;

    // Absorb every subsequent match that overlaps the current group.
    while (index < matches.length) {
      const next = matches[index];

      if (!next || next.detection.start >= end) {
        break;
      }

      contributors.push(next);
      end = Math.max(end, next.detection.end);
      index++;
    }

    groups.push({ contributors, start, end });
  }

  return groups;
}

export interface RestorationContext {
  readonly map: Map<string, string>;
  readonly counters: Map<string, number>;
  readonly reverseMap?: Map<string, string>;
}

export function createRestorationContext(dedup?: boolean): RestorationContext {
  return {
    map: new Map(),
    counters: new Map(),
    reverseMap: dedup ? new Map() : undefined,
  };
}

// ---------------------------------------------------------------------------
// Safe-portion rendering
// ---------------------------------------------------------------------------

/**
 * Render the safe portion of a buffer up to `flushPoint`.
 *
 * Filters matches to those ending at or before `flushPoint`, groups overlaps,
 * resolves replacements, and returns segments that can be mapped to stream
 * events.  When `report` is true, replacement segments carry the
 * `InspectionGroup` so callers can emit detection events.
 */
function renderSafePortion(
  text: string,
  matches: AppliedMatch[],
  flushPoint: number,
  report: boolean,
  startCursor: number = 0,
  restoration?: RestorationContext,
  detectOnly: boolean = false,
): {
  segments: RenderedSegment[];
  groups: InspectionGroup[];
  consumed: number;
} {
  const sorted = [...matches].sort(compareMatches);

  const allGroups = groupOverlappingMatches(sorted);

  let effectiveFlush = flushPoint;

  for (const group of allGroups) {
    if (group.end > flushPoint && group.start < effectiveFlush) {
      effectiveFlush = group.start;
    }
  }

  if (effectiveFlush <= startCursor) {
    return { segments: [], groups: [], consumed: effectiveFlush };
  }

  const segments: RenderedSegment[] = [];
  const inspectionGroups: InspectionGroup[] = [];
  let cursor = startCursor;

  for (const group of allGroups) {
    if (group.end > effectiveFlush) {
      break;
    }

    if (group.start < startCursor) {
      continue;
    }

    const { contributors, start, end } = group;

    let replacement: string;
    let action: AuditAction | undefined;

    if (detectOnly) {
      replacement = text.slice(start, end);
      const { action: winningAction } = resolveWinningAction(contributors);
      action = winningAction;
    } else {
      const resolved = resolveReplacement(
        text,
        contributors,
        start,
        end,
        restoration,
      );
      replacement = resolved.replacement;
      action = resolved.action;
    }

    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start) });
    }

    if (report) {
      const inspectionGroup: InspectionGroup = {
        start,
        end,
        replacement,
        action,
        matches: contributors.map(({ detection }) => ({
          ...detection,
          value: text.slice(detection.start, detection.end),
        })),
      };

      inspectionGroups.push(inspectionGroup);
      segments.push({ text: replacement, group: inspectionGroup });
    } else {
      segments.push({ text: replacement });
    }

    cursor = end;
  }

  if (effectiveFlush > cursor) {
    segments.push({ text: text.slice(cursor, effectiveFlush) });
  }

  return { segments, groups: inspectionGroups, consumed: effectiveFlush };
}

// ---------------------------------------------------------------------------
// Allowlist filtering
// ---------------------------------------------------------------------------

function filterAllowlisted(
  matches: AppliedMatch[],
  allowlist: Set<string>,
  text: string,
): AppliedMatch[] {
  if (allowlist.size === 0) {
    return matches;
  }

  return matches.filter(({ detection }) => {
    const value = text.slice(detection.start, detection.end);

    return !allowlist.has(value);
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Collect matches from all rules, filter placeholder overlaps and allowlist.
 *
 * Extracted from `detectAndRender` so the async semantic confirmation flow
 * can collect matches, filter them via Jev, then render the survivors.
 */
export function collectMatches(
  text: string,
  rules: readonly ActiveRule[],
  allowlist: Set<string> = new Set(),
): AppliedMatch[] {
  const matches = rules.flatMap((rule) =>
    rule.detector.detect(text).map((detection) => ({ detection, rule })),
  );

  const placeholders = findPlaceholderSpans(text);
  const filtered = filterPlaceholderMatches(matches, placeholders);

  return filterAllowlisted(filtered, allowlist, text);
}

/**
 * Render pre-collected matches up to `flushPoint`.
 *
 * Shared between `detectAndRender` (sync) and `redactAsync` (async after
 * semantic filtering).
 */
export function renderMatches(
  text: string,
  matches: AppliedMatch[],
  flushPoint: number,
  report: boolean,
  startCursor: number = 0,
  restoration?: RestorationContext,
  detectOnly: boolean = false,
): {
  segments: RenderedSegment[];
  groups: InspectionGroup[];
  consumed: number;
} {
  return renderSafePortion(
    text,
    matches,
    flushPoint,
    report,
    startCursor,
    restoration,
    detectOnly,
  );
}

/**
 * Collect matches from all rules, filter placeholder overlaps, and render
 * the safe portion up to `flushPoint`.
 *
 * This is the shared seam between complete-string and streaming paths.
 */
export function detectAndRender(
  text: string,
  rules: readonly ActiveRule[],
  flushPoint: number,
  report: boolean,
  startCursor: number = 0,
  restoration?: RestorationContext,
  allowlist: Set<string> = new Set(),
  detectOnly: boolean = false,
): {
  segments: RenderedSegment[];
  groups: InspectionGroup[];
  consumed: number;
} {
  const allowlisted = collectMatches(text, rules, allowlist);

  return renderSafePortion(
    text,
    allowlisted,
    flushPoint,
    report,
    startCursor,
    restoration,
    detectOnly,
  );
}

/** Shared complete-input resolver. Streaming can call this after safe boundaries resolve. */
export function processText(
  text: string,
  rules: readonly ActiveRule[],
  report: boolean,
  restore?: boolean,
  allowlist: Set<string> = new Set(),
  detectOnly: boolean = false,
): Inspection & { map?: RestorationMap } {
  const restoration =
    restore && !detectOnly ? createRestorationContext() : undefined;

  const { segments, groups } = detectAndRender(
    text,
    rules,
    text.length,
    report,
    0,
    restoration,
    allowlist,
    detectOnly,
  );

  const result: Inspection & { map?: RestorationMap } = {
    text: segments.map((s) => s.text).join(""),
    groups,
  };

  if (restoration) {
    result.map = Object.fromEntries(restoration.map.entries());
  }

  return result;
}
