import type { Detection } from "../../types";
import { Detector } from "../base";

const hex = "[0-9A-Fa-f]{2}";
const macColonPattern = new RegExp(`(?:${hex}:){5}${hex}`, "g");
const macHyphenPattern = new RegExp(`(?:${hex}-){5}${hex}`, "g");

const hexChar = /[0-9A-Fa-f]/;

export class MacAddressDetector extends Detector {
  readonly id = "mac_address";
  readonly entityType = "mac_address";
  readonly replacement = "[MAC_ADDRESS]";

  override readonly stream = Object.freeze({
    maxMatchLength: 17,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const pattern of [macColonPattern, macHyphenPattern]) {
      pattern.lastIndex = 0;

      for (const match of text.matchAll(pattern)) {
        const start = match.index;
        const end = start + match[0].length;

        if (this.isAdjacentForbidden(text, start, end)) {
          continue;
        }

        // Reject if followed by the same separator + hex digit (7+ groups)
        const separator = pattern === macColonPattern ? ":" : "-";
        const nextChar = text[end];
        const afterNext = text[end + 1];

        if (
          nextChar === separator &&
          afterNext !== undefined &&
          hexChar.test(afterNext)
        ) {
          continue;
        }

        candidates.push({
          start,
          end,
          ruleId: "mac_address",
          entityType: "mac_address",
          reasons: ["mac_address.format"],
        });
      }
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const macAddressDetector = new MacAddressDetector();
