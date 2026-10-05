import type { Detection } from "../types";
import { Detector } from "./base";

/**
 * Abstract base for detectors that share the checksum-validation pipeline:
 * matchAll → adjacency check → validate → push → filterGraphemeAligned.
 *
 * Subclasses provide a pattern and a validate hook. The validate hook
 * returns `false` to reject a candidate, or a reasons array to accept it.
 */
export abstract class ChecksumDetector extends Detector {
  protected abstract pattern: RegExp;

  protected abstract validate(candidate: string): false | readonly string[];

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(this.pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      const candidate = match[0];

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      const reasons = this.validate(candidate);

      if (reasons === false) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: this.id,
        entityType: this.entityType,
        reasons: [...reasons],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}
