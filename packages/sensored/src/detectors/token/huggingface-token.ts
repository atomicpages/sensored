import type { Detection } from "../../types";
import { Detector } from "../base";

const huggingfaceTokenPattern = /(?:hf_|api_org_)[a-zA-Z0-9]{34}/g;

export class HuggingFaceTokenDetector extends Detector {
  readonly id = "huggingface_token";
  readonly entityType = "huggingface_token";
  readonly replacement = "[HUGGINGFACE_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 42,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(huggingfaceTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "huggingface_token",
        entityType: "huggingface_token",
        reasons: ["huggingface_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const huggingFaceTokenDetector = new HuggingFaceTokenDetector();
