import { KeywordDetector } from "../base";

export class PagerDutyTokenDetector extends KeywordDetector {
  readonly id = "pagerduty_token";
  readonly entityType = "pagerduty_token";
  readonly replacement = "[PAGERDUTY_TOKEN]";

  override readonly stream = Object.freeze({
    maxMatchLength: 20,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern = /[A-Za-z][A-Za-z0-9_+]{19}/;
  protected readonly keywords = [
    "pagerduty",
    "pager_duty",
    "pd_",
    "pd-",
  ] as const;
}

export const pagerDutyTokenDetector = new PagerDutyTokenDetector();
