import type { Detection } from "../../types";
import { Detector } from "../base";

const postalCodePattern =
  /\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|[A-Z]\d[A-Z] ?\d[A-Z]\d|\d{4}/gi;

export class PostalCodeDetector extends Detector {
  readonly id = "postal_code";
  readonly entityType = "postal_code";
  readonly replacement = "[POSTAL_CODE]";

  override readonly stream = Object.freeze({
    maxMatchLength: 10,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(postalCodePattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
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
