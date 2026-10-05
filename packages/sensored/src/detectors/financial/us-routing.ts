import { ContextDetector, streamMeta } from "../base";

function routingChecksum(digits: string): boolean {
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]!, 10) * weights[i]!;
  }

  return sum % 10 === 0;
}

export class UsRoutingDetector extends ContextDetector {
  readonly id = "us_routing";
  readonly entityType = "us_routing";
  readonly replacement = "[US_ROUTING]";

  protected readonly pattern = /\d{9}/g;
  protected readonly contextLabels =
    "(?:routing[- ]?(?:no\\.?|number)?|aba|rtn)";
  protected readonly labelStrings = [
    "routing",
    "routing no.",
    "routing no",
    "routing number",
    "aba",
    "rtn",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);

  protected override validate(candidate: string): false | readonly string[] {
    if (!routingChecksum(candidate)) {
      return false;
    }

    return ["us_routing.checksum", "us_routing.format"];
  }
}

export const usRoutingDetector = new UsRoutingDetector();
