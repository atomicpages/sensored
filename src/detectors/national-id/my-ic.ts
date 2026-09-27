import { ContextDetector, streamMeta } from "../base";

function myIcValid(candidate: string): boolean {
  const digits = candidate.replace(/[-\s]/g, "");

  if (digits.length !== 12) {
    return false;
  }

  const month = Number.parseInt(digits.slice(2, 4), 10);
  const day = Number.parseInt(digits.slice(4, 6), 10);

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class MyIcDetector extends ContextDetector {
  readonly id = "my_ic";
  readonly entityType = "my_ic";
  readonly replacement = "[MY_IC]";

  protected readonly pattern = /\d{6}[-\s]?\d{2}[-\s]?\d{4}/g;
  protected readonly contextLabels =
    "(?:Malaysia|Malaysian|MyKad|IC Number|Kad Pengenalan)";
  protected readonly labelStrings = [
    "Malaysia",
    "Malaysian",
    "MyKad",
    "IC Number",
    "Kad Pengenalan",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    14,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!myIcValid(candidate)) {
      return false;
    }

    return ["my_ic.format"];
  }
}

export const myIcDetector = new MyIcDetector();
