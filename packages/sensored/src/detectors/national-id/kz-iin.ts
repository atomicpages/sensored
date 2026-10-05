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

export class KzIinDetector extends ContextDetector {
  readonly id = "kz_iin";
  readonly entityType = "kz_iin";
  readonly replacement = "[KZ_IIN]";

  protected readonly pattern = /\d{12}/g;
  protected readonly contextLabels =
    "(?:Kazakhstan|Kazakh|IIN|Individual Identification|ЖСН)";
  protected readonly labelStrings = [
    "Kazakhstan",
    "Kazakh",
    "IIN",
    "Individual Identification",
    "ЖСН",
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

    return ["kz_iin.format"];
  }
}

export const kzIinDetector = new KzIinDetector();
