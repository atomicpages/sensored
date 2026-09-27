import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 12) {
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

export class KwIdDetector extends ContextDetector {
  readonly id = "kw_id";
  readonly entityType = "kw_id";
  readonly replacement = "[KW_ID]";

  protected readonly pattern = /\d{12}/g;
  protected readonly contextLabels = "(?:Kuwait|Civil ID|National ID)";
  protected readonly labelStrings = [
    "Kuwait",
    "Civil ID",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    12,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["kw_id.structure"];
  }
}

export const kwIdDetector = new KwIdDetector();
