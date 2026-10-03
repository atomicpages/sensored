import type { Detection } from "../../types";
import { Detector } from "../base";

const sentryTokenPattern =
  /sntrys_eyJ[a-zA-Z0-9=_+/]{197}|sntryu_[a-f0-9]{64}/g;

export class SentryTokenDetector extends Detector {
  readonly id = "sentry_token";
  readonly entityType = "sentry_token";
  readonly replacement = "[SENTRY_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 210,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(sentryTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "sentry_token",
        entityType: "sentry_token",
        reasons: ["sentry_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const sentryTokenDetector = new SentryTokenDetector();
