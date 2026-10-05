import { KeywordDetector } from "../base";

export class MailgunApiKeyDetector extends KeywordDetector {
  readonly id = "mailgun_api_key";
  readonly entityType = "mailgun_api_key";
  readonly replacement = "[MAILGUN_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 80,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern =
    /key-[a-z0-9]{32}|[a-f0-9]{32}-[a-f0-9]{8}-[a-f0-9]{8}/;
  protected readonly keywords = ["mailgun"] as const;
}

export const mailgunApiKeyDetector = new MailgunApiKeyDetector();
