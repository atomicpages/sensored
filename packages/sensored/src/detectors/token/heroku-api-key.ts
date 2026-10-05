import type { Detection } from "../../types";
import { Detector } from "../base";

const herokuApiKeyPattern = /HRKU-[0-9a-zA-Z_-]{60}/g;

export class HerokuApiKeyDetector extends Detector {
  readonly id = "heroku_api_key";
  readonly entityType = "heroku_api_key";
  readonly replacement = "[HEROKU_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 65,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(herokuApiKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "heroku_api_key",
        entityType: "heroku_api_key",
        reasons: ["heroku_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const herokuApiKeyDetector = new HerokuApiKeyDetector();
