import type { Detection } from "../../types";
import { Detector } from "../base";
import { npiLuhnValid } from "../checksum";

const DATE_PATTERNS = [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}-\d{2}-\d{4}$/];

const PLUS_PREFIX_LENGTHS: Record<string, number[]> = {
  "1": [11],
  "44": [12, 13],
  "61": [11],
  "81": [11],
};

function isValidPhone(candidate: string): boolean {
  for (const pattern of DATE_PATTERNS) {
    if (pattern.test(candidate)) {
      return false;
    }
  }

  const hasPlus = candidate.startsWith("+");
  const digits = candidate.replace(/\D/g, "");

  if (hasPlus) {
    for (const [prefix, lengths] of Object.entries(PLUS_PREFIX_LENGTHS)) {
      if (digits.startsWith(prefix) && lengths.includes(digits.length)) {
        return true;
      }
    }

    return false;
  }

  if (digits.length === 10) {
    return true;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return true;
  }

  return false;
}

export class PhoneDetector extends Detector {
  readonly id = "phone";
  readonly entityType = "phone";
  readonly replacement = "[PHONE]";

  override readonly stream = Object.freeze({
    maxMatchLength: 20,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(/\+?\(?\d[\d ()-]{0,16}\d/g)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (!isValidPhone(match[0])) {
        continue;
      }

      // Exclude 10-digit numbers that pass NPI Luhn validation —
      // those are NPI numbers, not phone numbers.
      const bareDigits = match[0].replace(/\D/g, "");

      if (bareDigits.length === 10 && npiLuhnValid(bareDigits)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "phone",
        entityType: "phone",
        reasons: ["phone.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const phoneDetector = new PhoneDetector();
