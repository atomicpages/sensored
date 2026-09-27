import type { ContextHint, Detection } from "../../types";
import { createContextMatcher, Detector } from "../base";

const LEFT_CONTEXT = 30;
const RIGHT_CONTEXT = 20;

const LABELS =
  "(?:Username|User ID|Handle|Screen Name|Gamertag|Discord ID|Steam ID|PSN ID|Xbox Gamertag)";

const LABEL_STRINGS = [
  "Username",
  "User ID",
  "Handle",
  "Screen Name",
  "Gamertag",
  "Discord ID",
  "Steam ID",
  "PSN ID",
  "Xbox Gamertag",
] as const;

const { hasPrecedingContext, hasContext } = createContextMatcher(
  LABELS,
  LEFT_CONTEXT,
  RIGHT_CONTEXT,
);

// For generic usernames, only accept parenthesized following context
// (e.g. "john_doe (Username)") to avoid false positives from the broad
// [\w] pattern matching ordinary words that happen to precede a label.
const followingParenPattern = new RegExp(`^[ \\t]{1,8}\\(${LABELS}\\)`, "iu");

function hasFollowingParenContext(text: string, end: number): boolean {
  const after = text.slice(end, end + RIGHT_CONTEXT);

  return followingParenPattern.test(after);
}

function hasContextForGeneric(
  text: string,
  start: number,
  end: number,
): boolean {
  return (
    hasPrecedingContext(text, start) || hasFollowingParenContext(text, end)
  );
}

const blocklist = new Set([
  "the",
  "and",
  "for",
  "admin",
  "but",
  "not",
  "are",
  "was",
  "has",
  "had",
  "this",
  "that",
  "with",
  "from",
  "your",
  "have",
  "more",
  "will",
  "can",
  "all",
  "any",
  "get",
  "set",
  "new",
  "old",
  "one",
  "two",
  "out",
  "how",
  "who",
  "why",
  "yes",
  "you",
  "its",
  "our",
  "now",
]);

function isPureNumeric(value: string): boolean {
  return /^\d+$/.test(value);
}

function isNumericId(value: string): boolean {
  return /^\d{17,19}$/.test(value);
}

function isAtHandle(value: string): boolean {
  return value.startsWith("@");
}

function isSteamId(value: string): boolean {
  return /^STEAM_\d:\d:\d+$/.test(value);
}

export class DigitalIdentityDetector extends Detector {
  readonly id = "digital_identity";
  readonly entityType = "digital_identity";
  readonly replacement = "[DIGITAL_IDENTITY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 32,
    leftContext: LEFT_CONTEXT,
    rightContext: RIGHT_CONTEXT,
    boundaryLookaround: 1,
  });

  override get contextHint(): ContextHint {
    return Object.freeze({
      required: true,
      labels: Object.freeze([...LABEL_STRINGS]),
      position: "both" as const,
      window: Object.freeze({
        before: LEFT_CONTEXT,
        after: RIGHT_CONTEXT,
      }),
      instructions:
        'Generic usernames require preceding context or parenthesized following context (e.g. "john_doe (Username)"). @-handles, Discord IDs, and Steam IDs accept any context position.',
    });
  }

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(
      /STEAM_\d:\d:\d{1,20}|@[\w](?:[\w.]{0,29}[\w])?|\d{17,19}|[\w][\w.]{1,30}[\w]/giu,
    )) {
      const start = match.index;
      const end = start + match[0].length;
      const value = match[0];

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      // Generic usernames require preceding context or parenthesized
      // following context.  @-handles, Discord IDs, and Steam IDs
      // are distinctive enough to use any context (including
      // non-parenthesized following labels).
      if (isAtHandle(value) || isNumericId(value) || isSteamId(value)) {
        if (!hasContext(text, start, end)) {
          continue;
        }
      } else {
        if (!hasContextForGeneric(text, start, end)) {
          continue;
        }
      }

      if (blocklist.has(value.toLowerCase())) {
        continue;
      }

      // Reject pure numeric strings that aren't Discord/Steam IDs
      if (isPureNumeric(value) && !isNumericId(value)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "digital_identity",
        entityType: "digital_identity",
        reasons: ["digital_identity.format", "digital_identity.context"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const digitalIdentityDetector = new DigitalIdentityDetector();
