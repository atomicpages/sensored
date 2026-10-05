import type { Detection } from "../../types";
import { Detector } from "../base";

const invalidFirstLetters = new Set(["D", "F", "I", "Q", "U", "V"]);
const invalidSecondLetters = new Set(["O"]);
const validSuffixLetters = new Set([
  "A",
  "B",
  "C",
  "D",
  "F",
  "J",
  "H",
  "M",
  "N",
  "P",
  "R",
  "S",
  "T",
  "W",
  "X",
  "Y",
  "Z",
]);

function isValidNino(candidate: string): boolean {
  const first = candidate[0]?.toUpperCase();
  const second = candidate[1]?.toUpperCase();
  const suffix = candidate[candidate.length - 1]?.toUpperCase();

  if (first && invalidFirstLetters.has(first)) {
    return false;
  }

  if (second && invalidSecondLetters.has(second)) {
    return false;
  }

  if (suffix && !validSuffixLetters.has(suffix)) {
    return false;
  }

  return true;
}

export class UkNinoDetector extends Detector {
  readonly id = "uk_nino";
  readonly entityType = "uk_nino";
  readonly replacement = "[UK_NINO]";

  override readonly stream = Object.freeze({
    maxMatchLength: 14,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(
      /[A-Z]{2} ?\d{2} ?\d{2} ?\d{2} ?[A-Z]/gi,
    )) {
      const start = match.index;
      const end = start + match[0].length;
      const candidate = match[0];

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (!isValidNino(candidate)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "uk_nino",
        entityType: "uk_nino",
        reasons: ["uk_nino.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const ukNinoDetector = new UkNinoDetector();
