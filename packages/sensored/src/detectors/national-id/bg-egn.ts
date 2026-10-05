import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 10) {
    return false;
  }

  const month = Number.parseInt(candidate.slice(2, 4), 10);
  const day = Number.parseInt(candidate.slice(4, 6), 10);

  if (
    !(
      (month >= 1 && month <= 12) ||
      (month >= 21 && month <= 32) ||
      (month >= 41 && month <= 52)
    )
  ) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class BgEgnDetector extends ContextDetector {
  readonly id = "bg_egn";
  readonly entityType = "bg_egn";
  readonly replacement = "[BG_EGN]";

  protected readonly pattern = /\d{10}/g;
  protected readonly contextLabels =
    "(?:Bulgaria|Bulgarian|EGN|Personal Number|Единен)";
  protected readonly labelStrings = [
    "Bulgaria",
    "Bulgarian",
    "EGN",
    "Personal Number",
    "Единен",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["bg_egn.structure"];
  }
}

export const bgEgnDetector = new BgEgnDetector();
