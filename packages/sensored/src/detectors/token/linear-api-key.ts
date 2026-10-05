import type { Detection } from "../../types";
import { Detector } from "../base";

const linearApiKeyPattern = /lin_api_[0-9A-Za-z]{40}/g;

export class LinearApiKeyDetector extends Detector {
  readonly id = "linear_api_key";
  readonly entityType = "linear_api_key";
  readonly replacement = "[LINEAR_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 48,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(linearApiKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "linear_api_key",
        entityType: "linear_api_key",
        reasons: ["linear_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const linearApiKeyDetector = new LinearApiKeyDetector();
