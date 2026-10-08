import type { AppliedMatch, RestorationContext } from "../engine";
import type { RedactRule } from "../types";
import { renderFormatPreserve } from "./format-preserve";
import { renderMask } from "./mask";
import { renderTokenReplace } from "./token-replace";

// ---------------------------------------------------------------------------
// Action precedence resolution
// ---------------------------------------------------------------------------

export type ActionType =
  | "remove"
  | "redact"
  | "format-preserve"
  | "token-replace"
  | "mask";

interface WinningAction {
  action: ActionType;
  matches: AppliedMatch[];
}

/**
 * Walk the remove > redact > format-preserve > token-replace > mask
 * precedence once and return the winning action plus its contributing matches.
 *
 * For redact, only the highest-priority matches are returned. For mask,
 * all mask matches are returned (they union their hidden regions).
 */
export function resolveWinningAction(matches: AppliedMatch[]): WinningAction {
  const removeMatches = matches.filter(
    ({ rule }) => rule.setting.action === "remove",
  );

  if (removeMatches.length > 0) {
    return { action: "remove", matches: removeMatches };
  }

  let hasRedact = false;
  let priority = -Infinity;
  let winners: AppliedMatch[] = [];

  for (const match of matches) {
    if (match.rule.setting.action !== "redact") {
      continue;
    }

    hasRedact = true;
    const rank = match.rule.setting.priority ?? 0;

    if (rank > priority) {
      winners = [match];
      priority = rank;
    } else if (rank === priority) {
      winners.push(match);
    }
  }

  if (hasRedact) {
    return { action: "redact", matches: winners };
  }

  const formatPreserveMatches = matches.filter(
    ({ rule }) => rule.setting.action === "format-preserve",
  );

  if (formatPreserveMatches.length > 0) {
    return { action: "format-preserve", matches: formatPreserveMatches };
  }

  const tokenReplaceMatches = matches.filter(
    ({ rule }) => rule.setting.action === "token-replace",
  );

  if (tokenReplaceMatches.length > 0) {
    return { action: "token-replace", matches: tokenReplaceMatches };
  }

  const maskMatches = matches.filter(
    ({ rule }) => rule.setting.action === "mask",
  );

  return { action: "mask", matches: maskMatches };
}

function resolveWinningEntityType(matches: AppliedMatch[]): string {
  const { action, matches: winners } = resolveWinningAction(matches);

  if (action === "remove") {
    return winners[0]?.rule.detector.entityType ?? "REDACTED";
  }

  if (action === "redact") {
    const entityTypes = new Set(winners.map((w) => w.rule.detector.entityType));

    if (entityTypes.size === 1) {
      return winners[0]?.rule.detector.entityType ?? "REDACTED";
    }

    return "REDACTED";
  }

  return winners[0]?.rule.detector.entityType ?? "REDACTED";
}

function resolveRestorationPlaceholder(
  text: string,
  matches: AppliedMatch[],
  start: number,
  end: number,
  restoration: RestorationContext,
): string {
  const originalText = text.slice(start, end);
  const entityType = resolveWinningEntityType(matches);
  const placeholderBase = entityType.toUpperCase();

  if (restoration.reverseMap) {
    const existing = restoration.reverseMap.get(originalText);
    if (existing) {
      return existing;
    }
  }

  const counter = (restoration.counters.get(placeholderBase) ?? 0) + 1;
  restoration.counters.set(placeholderBase, counter);

  const placeholder = `[${placeholderBase}_${counter}]`;
  restoration.map.set(placeholder, originalText);

  if (restoration.reverseMap) {
    restoration.reverseMap.set(originalText, placeholder);
  }

  return placeholder;
}

// ---------------------------------------------------------------------------
// Replacement resolution
// ---------------------------------------------------------------------------

/** Remove wins outright — the entire group is erased. */
function resolveRemove(): string {
  return "";
}

/**
 * Pick the redaction replacement from winning redact matches.
 *
 * All matches are already the highest-priority redact winners.
 * If they agree on a single replacement string, use it; otherwise
 * fall back to "[REDACTED]" to avoid non-deterministic output.
 */
function resolveRedaction(matches: AppliedMatch[]): string {
  const replacements = new Set<string>();

  for (const { rule } of matches) {
    const setting = rule.setting as RedactRule;
    replacements.add(setting.replacement ?? rule.detector.replacement);
  }

  if (replacements.size === 1) {
    return [...replacements][0] ?? "[REDACTED]";
  }

  return "[REDACTED]";
}

/**
 * Resolve a group's replacement text.
 *
 * Precedence: remove > redact > format-preserve > token-replace > mask.
 * Within redact, the highest explicit priority wins.
 */
export interface ResolvedReplacement {
  readonly replacement: string;
  readonly action: ActionType;
}

export function resolveReplacement(
  text: string,
  matches: AppliedMatch[],
  start: number,
  end: number,
  restoration?: RestorationContext,
): ResolvedReplacement {
  if (restoration) {
    return {
      replacement: resolveRestorationPlaceholder(
        text,
        matches,
        start,
        end,
        restoration,
      ),
      action: "redact",
    };
  }

  const { action, matches: winners } = resolveWinningAction(matches);

  if (action === "remove") {
    return { replacement: resolveRemove(), action };
  }

  if (action === "redact") {
    return { replacement: resolveRedaction(winners), action };
  }

  if (action === "format-preserve") {
    return { replacement: renderFormatPreserve(text, start, end), action };
  }

  if (action === "token-replace") {
    return {
      replacement: renderTokenReplace(text, winners, start, end),
      action,
    };
  }

  return { replacement: renderMask(text, winners, start, end), action };
}
