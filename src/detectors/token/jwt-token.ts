import type { Detection } from "../../types";
import { Detector } from "../base";

const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const trailingUnderscore = /_+$/;

export class JwtTokenDetector extends Detector {
  readonly id = "jwt_token";
  readonly entityType = "jwt_token";
  readonly replacement = "[JWT_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 4096,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(jwtPattern)) {
      const start = match.index;
      let end = start + match[0].length;

      // Trim trailing underscores so isAdjacentForbidden can detect
      // matches embedded in larger words.
      const trailing = text.slice(start, end).match(trailingUnderscore);

      if (trailing) {
        end -= trailing[0].length;
      }

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "jwt_token",
        entityType: "jwt_token",
        reasons: ["jwt_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const jwtTokenDetector = new JwtTokenDetector();
