import type { Detection } from "../../types";
import { Detector } from "../base";

const openaiApiKeyPattern = /sk-[a-zA-Z0-9_-]+T3BlbkFJ[a-zA-Z0-9_-]+/g;

export class OpenAIApiKeyDetector extends Detector {
  readonly id = "openai_api_key";
  readonly entityType = "openai_api_key";
  readonly replacement = "[OPENAI_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 200,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(openaiApiKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "openai_api_key",
        entityType: "openai_api_key",
        reasons: ["openai_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const openAIApiKeyDetector = new OpenAIApiKeyDetector();
