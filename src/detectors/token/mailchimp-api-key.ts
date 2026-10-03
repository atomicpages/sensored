import type { Detection } from "../../types";
import { Detector } from "../base";

const mailchimpApiKeyPattern = /[0-9a-f]{32}-us[0-9]{1,2}/g;

export class MailchimpApiKeyDetector extends Detector {
  readonly id = "mailchimp_api_key";
  readonly entityType = "mailchimp_api_key";
  readonly replacement = "[MAILCHIMP_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 40,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(mailchimpApiKeyPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "mailchimp_api_key",
        entityType: "mailchimp_api_key",
        reasons: ["mailchimp_api_key.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const mailchimpApiKeyDetector = new MailchimpApiKeyDetector();
