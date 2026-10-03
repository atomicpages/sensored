import type { Detection } from "../../types";
import { Detector } from "../base";

const digitaloceanTokenPattern = /(?:dop_v1_|doo_v1_|dor_v1_)[a-f0-9]{64}/g;

export class DigitalOceanTokenDetector extends Detector {
  readonly id = "digitalocean_token";
  readonly entityType = "digitalocean_token";
  readonly replacement = "[DIGITALOCEAN_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 71,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(digitaloceanTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "digitalocean_token",
        entityType: "digitalocean_token",
        reasons: ["digitalocean_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const digitalOceanTokenDetector = new DigitalOceanTokenDetector();
