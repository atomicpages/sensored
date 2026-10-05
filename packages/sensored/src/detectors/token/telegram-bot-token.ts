import type { Detection } from "../../types";
import { Detector } from "../base";

const telegramBotTokenPattern = /[0-9]+:AA[a-zA-Z0-9_-]{35}/g;

export class TelegramBotTokenDetector extends Detector {
  readonly id = "telegram_bot_token";
  readonly entityType = "telegram_bot_token";
  readonly replacement = "[TELEGRAM_BOT_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 60,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  });

  override detect(text: string): Detection[] {
    const candidates: Detection[] = [];

    for (const match of text.matchAll(telegramBotTokenPattern)) {
      const start = match.index;
      const end = start + match[0].length;

      if (this.isAdjacentForbidden(text, start, end)) {
        continue;
      }

      candidates.push({
        start,
        end,
        ruleId: "telegram_bot_token",
        entityType: "telegram_bot_token",
        reasons: ["telegram_bot_token.format"],
      });
    }

    return this.filterGraphemeAligned(candidates, text);
  }
}

export const telegramBotTokenDetector = new TelegramBotTokenDetector();
