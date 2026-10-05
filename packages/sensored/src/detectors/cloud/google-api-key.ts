import type { Detection } from "../../types";
import { Detector } from "../base";

const googleKeyPattern = /AIza[0-9A-Za-z_-]{35}/g;

export class GoogleApiKeyDetector extends Detector {
  readonly id = "google_api_key";
  readonly entityType = "google_api_key";
  readonly replacement = "[GOOGLE_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 39,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(googleKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "google_api_key",
        entityType: "google_api_key",
        reasons: ["google_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const googleApiKeyDetector = new GoogleApiKeyDetector();
