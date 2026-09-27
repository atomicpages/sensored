import type { Detection } from "../../types";
import { Detector } from "../base";

const urlWithAuthPattern =
  /(?:https?|ftp):\/\/[^\s:/@?#]+:[^\s/@?#]+@[^\s/@?#]+[^\s]*/g;

const trailingUnderscore = /_+$/;

export class UrlWithAuthDetector extends Detector {
  readonly id = "url_with_auth";
  readonly entityType = "url_with_auth";
  readonly replacement = "[URL_WITH_AUTH]";

  override readonly stream = Object.freeze({
    maxMatchLength: 2048,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(urlWithAuthPattern)) {
      const start = match.index;
      let end = start + match[0].length;

      // Trim trailing underscores that the greedy [^\s]* consumed
      // so isAdjacentForbidden can properly detect embedded matches.
      const trailingMatch = text.slice(start, end).match(trailingUnderscore);

      if (trailingMatch) {
        end -= trailingMatch[0].length;
      }

      // Trim a single trailing period (prose punctuation, not URL suffix)
      if (
        text[end - 1] === "." &&
        (end === text.length || /\s/u.test(text[end] ?? ""))
      ) {
        end--;
      }

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "url_with_auth",
        entityType: "url_with_auth",
        reasons: ["url_with_auth.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const urlWithAuthDetector = new UrlWithAuthDetector();
