import type { Detection } from "../../types";
import { Detector } from "../base";

const notionTokenPattern = /(?:secret_|ntn_)[A-Za-z0-9]{43}/g;

export class NotionTokenDetector extends Detector {
  readonly id = "notion_token";
  readonly entityType = "notion_token";
  readonly replacement = "[NOTION_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 50,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(notionTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "notion_token",
        entityType: "notion_token",
        reasons: ["notion_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const notionTokenDetector = new NotionTokenDetector();
