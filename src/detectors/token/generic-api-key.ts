import type { ContextHint, Detection } from "../../types";
import { Detector } from "../base";

const genericApiKeyPattern =
  /(?:api.{0,5}key|apikey|api.{0,5}token)[:\s=]+([a-zA-Z0-9_-]{20,})/gi;

const excludedValues = /example|sample|test|fake|demo|placeholder|xxx/i;

const LABEL_STRINGS = ["API key", "apikey", "API token"] as const;

export class GenericApiKeyDetector extends Detector {
  readonly id = "generic_api_key";
  readonly entityType = "generic_api_key";
  readonly replacement = "[GENERIC_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 256,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override get contextHint(): ContextHint {
    return Object.freeze({
      required: true,
      labels: Object.freeze([...LABEL_STRINGS]),
      position: "preceding" as const,
      window: Object.freeze({ before: 0, after: 0 }),
      instructions:
        'Context is inline: the label (e.g. "api_key", "apikey", "api token") must immediately precede the key value, separated by a colon, whitespace, or equals sign.',
    });
  }

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(genericApiKeyPattern)) {
      const fullStart = match.index;
      const fullEnd = fullStart + match[0].length;
      const value = match[1];

      if (value === undefined) {
        continue;
      }

      // Extract just the key value span (capturing group 1)
      const valueStart = fullStart + match[0].indexOf(value);
      const valueEnd = valueStart + value.length;

      if (this.isAdjacentForbidden(text, valueStart, valueEnd)) {
        continue;
      }

      if (excludedValues.test(value)) {
        continue;
      }

      candidates.push({
        start: valueStart,
        end: valueEnd,
        ruleId: "generic_api_key",
        entityType: "generic_api_key",
        reasons: ["generic_api_key.context", "generic_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const genericApiKeyDetector = new GenericApiKeyDetector();
