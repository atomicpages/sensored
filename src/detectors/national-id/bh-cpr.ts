import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 9) {
    return false;
  }

  const month = Number.parseInt(candidate.slice(2, 4), 10);
  const day = Number.parseInt(candidate.slice(4, 6), 10);

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class BhCprDetector extends ContextDetector {
  readonly id = "bh_cpr";
  readonly entityType = "bh_cpr";
  readonly replacement = "[BH_CPR]";

  protected readonly pattern = /\d{9}/g;
  protected readonly contextLabels =
    "(?:Bahrain|CPR|Central Population|National ID)";
  protected readonly labelStrings = [
    "Bahrain",
    "CPR",
    "Central Population",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["bh_cpr.structure"];
  }
}

export const bhCprDetector = new BhCprDetector();
