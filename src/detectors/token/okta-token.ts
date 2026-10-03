import { KeywordDetector } from "../base";

export class OktaTokenDetector extends KeywordDetector {
  readonly id = "okta_token";
  readonly entityType = "okta_token";
  readonly replacement = "[OKTA_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 42,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern = /00[a-zA-Z0-9_-]{40}/;
  protected readonly keywords = ["okta"] as const;
}

export const oktaTokenDetector = new OktaTokenDetector();
