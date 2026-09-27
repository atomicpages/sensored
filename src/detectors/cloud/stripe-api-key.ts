import type { Detection } from "../../types";
import { Detector } from "../base";

const stripeKeyPattern = /(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}/g;

export class StripeApiKeyDetector extends Detector {
  readonly id = "stripe_api_key";
  readonly entityType = "stripe_api_key";
  readonly replacement = "[STRIPE_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 128,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(stripeKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "stripe_api_key",
        entityType: "stripe_api_key",
        reasons: ["stripe_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const stripeApiKeyDetector = new StripeApiKeyDetector();
