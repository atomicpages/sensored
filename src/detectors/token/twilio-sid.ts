import type { Detection } from "../../types";
import { Detector } from "../base";

const twilioSidPattern = /AC[0-9a-f]{32}/g;

export class TwilioSidDetector extends Detector {
  readonly id = "twilio_sid";
  readonly entityType = "twilio_sid";
  readonly replacement = "[TWILIO_SID]";

  override readonly stream = Object.freeze({
    maxMatchLength: 34,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(twilioSidPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "twilio_sid",
        entityType: "twilio_sid",
        reasons: ["twilio_sid.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const twilioSidDetector = new TwilioSidDetector();
