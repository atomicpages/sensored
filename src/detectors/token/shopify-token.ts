import type { Detection } from "../../types";
import { Detector } from "../base";

const shopifyTokenPattern =
  /(?:shppa_|shpat_|shpca_)[0-9A-Fa-f]{32,38}|shpss_[a-fA-F0-9]{32,38}/g;

export class ShopifyTokenDetector extends Detector {
  readonly id = "shopify_token";
  readonly entityType = "shopify_token";
  readonly replacement = "[SHOPIFY_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 44,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(shopifyTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "shopify_token",
        entityType: "shopify_token",
        reasons: ["shopify_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const shopifyTokenDetector = new ShopifyTokenDetector();
