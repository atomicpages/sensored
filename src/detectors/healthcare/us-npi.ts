import type { Detection } from "../../types";
import { Detector } from "../base";
import { npiLuhnValid } from "../checksum";

const npiPattern = /\d{10}/g;

export class UsNpiDetector extends Detector {
  readonly id = "us_npi";
  readonly entityType = "us_npi";
  readonly replacement = "[US_NPI]";

  override readonly stream = Object.freeze({
    maxMatchLength: 10,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(npiPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      if (!npiLuhnValid(match[0])) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "us_npi",
        entityType: "us_npi",
        reasons: ["us_npi.checksum", "us_npi.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const usNpiDetector = new UsNpiDetector();
