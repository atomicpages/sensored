import type { Detection } from "../../types";
import { Detector } from "../base";

const slackWebhookUrlPattern =
  /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{23,25}/g;

export class SlackWebhookUrlDetector extends Detector {
  readonly id = "slack_webhook_url";
  readonly entityType = "slack_webhook_url";
  readonly replacement = "[SLACK_WEBHOOK_URL]";

  override readonly stream = Object.freeze({
    maxMatchLength: 120,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(slackWebhookUrlPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "slack_webhook_url",
        entityType: "slack_webhook_url",
        reasons: ["slack_webhook_url.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const slackWebhookUrlDetector = new SlackWebhookUrlDetector();
