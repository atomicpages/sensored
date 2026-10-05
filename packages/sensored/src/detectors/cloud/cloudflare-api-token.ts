import type { Detection } from "../../types";
import { Detector } from "../base";

const cloudflareApiTokenPattern = /(?:cfk_|cfut_|cfat_)[a-zA-Z0-9_-]{20,}/g;

export class CloudflareApiTokenDetector extends Detector {
  readonly id = "cloudflare_api_token";
  readonly entityType = "cloudflare_api_token";
  readonly replacement = "[CLOUDFLARE_API_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 100,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(cloudflareApiTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "cloudflare_api_token",
        entityType: "cloudflare_api_token",
        reasons: ["cloudflare_api_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const cloudflareApiTokenDetector = new CloudflareApiTokenDetector();
