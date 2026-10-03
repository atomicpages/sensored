import { KeywordDetector } from "../base";

export class DiscordBotTokenDetector extends KeywordDetector {
  readonly id = "discord_bot_token";
  readonly entityType = "discord_bot_token";
  readonly replacement = "[DISCORD_BOT_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 60,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern =
    /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/;
  protected readonly keywords = ["discord"] as const;
}

export const discordBotTokenDetector = new DiscordBotTokenDetector();
