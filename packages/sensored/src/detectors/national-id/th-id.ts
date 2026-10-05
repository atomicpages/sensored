import { ContextDetector, streamMeta } from "../base";

function thIdValid(candidate: string): boolean {
  if (candidate.length !== 13) {
    return false;
  }

  const digits = candidate.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += digits[i]! * (13 - i);
  }

  const checkDigit = (11 - (sum % 11)) % 10;

  return checkDigit === digits[12];
}

export class ThIdDetector extends ContextDetector {
  readonly id = "th_id";
  readonly entityType = "th_id";
  readonly replacement = "[TH_ID]";

  protected readonly pattern = /\d{13}/g;
  protected readonly contextLabels =
    "(?:Thailand|Thai|National ID|บัตร|ประชาชน)";
  protected readonly labelStrings = [
    "Thailand",
    "Thai",
    "National ID",
    "บัตร",
    "ประชาชน",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    13,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!thIdValid(candidate)) {
      return false;
    }

    return ["th_id.checksum"];
  }
}

export const thIdDetector = new ThIdDetector();
