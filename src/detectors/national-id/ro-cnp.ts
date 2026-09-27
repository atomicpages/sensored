import { ContextDetector, streamMeta } from "../base";

function structurallyValid(candidate: string): boolean {
  if (candidate.length !== 13) {
    return false;
  }

  const first = Number.parseInt(candidate[0]!, 10);

  if (first < 1 || first > 9) {
    return false;
  }

  const month = Number.parseInt(candidate.slice(3, 5), 10);

  if (month < 1 || month > 12) {
    return false;
  }

  const day = Number.parseInt(candidate.slice(5, 7), 10);

  if (day < 1 || day > 31) {
    return false;
  }

  return true;
}

export class RoCnpDetector extends ContextDetector {
  readonly id = "ro_cnp";
  readonly entityType = "ro_cnp";
  readonly replacement = "[RO_CNP]";

  protected readonly pattern = /\d{13}/g;
  protected readonly contextLabels =
    "(?:Romania|Romanian|CNP|Cod Numeric|Personal)";
  protected readonly labelStrings = [
    "Romania",
    "Romanian",
    "CNP",
    "Cod Numeric",
    "Personal",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    13,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!structurallyValid(candidate)) {
      return false;
    }

    return ["ro_cnp.structure"];
  }
}

export const roCnpDetector = new RoCnpDetector();
