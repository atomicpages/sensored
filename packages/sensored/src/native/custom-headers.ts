import { Detector } from "../detectors/base";
import type { Detection } from "../types";

/**
 * `detectorOptions.http_auth_header.customHeaders` RegExps, which cannot
 * cross JSON. Mirrors `HttpAuthHeaderDetector.detect` over the RegExp
 * alternatives only: the value is the first capture group that matched.
 *
 * Divergence: TS joins these alternatives into one pattern with the built-in
 * and string headers, so overlapping alternatives compete left to right.
 * Here they run as a separate scan, so where a RegExp header and a built-in
 * header both match overlapping text, both detections render as one group.
 */
export class HeaderPatternDetector extends Detector {
  readonly id = "http_auth_header";
  readonly entityType = "http_auth_header";
  readonly replacement = "[HTTP_AUTH_HEADER]";

  readonly #pattern: RegExp;

  constructor(patterns: readonly RegExp[]) {
    super();
    this.#pattern = new RegExp(patterns.map((p) => p.source).join("|"), "gi");
  }

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(this.#pattern)) {
      const value = match.slice(1).find((group) => group !== undefined);

      // The core rejects empty spans, so an empty capture is skipped.
      if (value === undefined || value.length === 0) {
        continue;
      }

      const start = match.index + match[0].lastIndexOf(value);
      const end = start + value.length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: this.id,
        entityType: this.entityType,
        reasons: ["http_auth_header.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}
