import { ContextDetector, streamMeta } from "../base";
import { luhnValid } from "../checksum";

function allSameDigit(candidate: string): boolean {
  if (candidate.length === 0) {
    return false;
  }

  const first = candidate[0];

  for (let i = 1; i < candidate.length; i++) {
    if (candidate[i] !== first) {
      return false;
    }
  }

  return true;
}

export class ImsiDetector extends ContextDetector {
  readonly id = "imsi";
  readonly entityType = "imsi";
  readonly replacement = "[IMSI]";

  protected readonly pattern = /\d{15}/g;
  protected readonly contextLabels =
    "(?:IMSI|Subscriber[- ]?ID|Subscriber[- ]?Number|Mobile[- ]?Subscriber)";
  protected readonly labelStrings = [
    "IMSI",
    "Subscriber ID",
    "Subscriber Number",
    "Mobile Subscriber",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    15,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (allSameDigit(candidate)) {
      return false;
    }

    if (luhnValid(candidate)) {
      return false;
    }

    return ["imsi.format"];
  }
}

export const imsiDetector = new ImsiDetector();
