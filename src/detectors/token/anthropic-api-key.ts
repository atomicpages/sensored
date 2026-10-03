import type { Detection } from "../../types";
import { Detector } from "../base";

const anthropicApiKeyPattern = /sk-ant-(?:admin01|api03)-[\w-]{93}AA/g;

export class AnthropicApiKeyDetector extends Detector {
  readonly id = "anthropic_api_key";
  readonly entityType = "anthropic_api_key";
  readonly replacement = "[ANTHROPIC_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 110,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(anthropicApiKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "anthropic_api_key",
        entityType: "anthropic_api_key",
        reasons: ["anthropic_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const anthropicApiKeyDetector = new AnthropicApiKeyDetector();
