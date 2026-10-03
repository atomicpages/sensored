import type { Detection } from "../../types";
import { Detector } from "../base";

const npmTokenPattern = /npm_[a-zA-Z0-9]{36}/g;

export class NpmTokenDetector extends Detector {
  readonly id = "npm_token";
  readonly entityType = "npm_token";
  readonly replacement = "[NPM_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 40,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(npmTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "npm_token",
        entityType: "npm_token",
        reasons: ["npm_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const npmTokenDetector = new NpmTokenDetector();
