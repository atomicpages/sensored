import type { Detection } from "../../types";
import { Detector } from "../base";

const postalCodePattern =
  /\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|[A-Z]\d[A-Z] ?\d[A-Z]\d|\d{4}/gi;

const digitOnly = /^[\d-]+$/;
const groupSeparator = /^[ .-]$/;
const alphanumeric = /^[a-z\d]$/i;
const digit = /^\d$/;

/** How far past the separator a neighbouring group is inspected. */
const NEIGHBOUR_SCAN = 6;

/**
 * True when the group across a separator from `from` is all digits. Only the
 * nearest `NEIGHBOUR_SCAN` characters are read, which keeps the stream
 * lookaround bounded.
 */
function isDigitGroup(text: string, from: number, step: 1 | -1): boolean {
  let seen = 0;

  for (let i = from; seen < NEIGHBOUR_SCAN; i += step) {
    const character = text[i] ?? "";

    if (!alphanumeric.test(character)) {
      break;
    }

    if (!digit.test(character)) {
      return false;
    }

    seen++;
  }

  return seen > 0;
}

/**
 * A digit-only candidate next to another digit group (`4111 1111`, `45-6789`,
 * `555.123`) is a slice of a longer number, not a postal code. A neighbour
 * holding letters (`K1A 1A1 2000`) is another postcode, so it does not count.
 */
function continuesDigitRun(text: string, start: number, end: number): boolean {
  const before =
    groupSeparator.test(text[start - 1] ?? "") &&
    isDigitGroup(text, start - 2, -1);

  const after =
    groupSeparator.test(text[end] ?? "") && isDigitGroup(text, end + 1, 1);

  return before || after;
}

export class PostalCodeDetector extends Detector {
  readonly id = "postal_code";
  readonly entityType = "postal_code";
  readonly replacement = "[POSTAL_CODE]";

  override readonly stream = Object.freeze({
    maxMatchLength: 10,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1 + NEIGHBOUR_SCAN,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(postalCodePattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (digitOnly.test(match[0]) && continuesDigitRun(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "postal_code",
        entityType: "postal_code",
        reasons: ["postal_code.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const postalCodeDetector = new PostalCodeDetector();
