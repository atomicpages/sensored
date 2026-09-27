import { ContextDetector, streamMeta } from "../base";

export class LicensePlateDetector extends ContextDetector {
  readonly id = "license_plate";
  readonly entityType = "license_plate";
  readonly replacement = "[LICENSE_PLATE]";

  protected readonly pattern =
    /[A-Z]{2}[0-9]{2}[A-Z]{3}|[0-9]{2}[A-Z]{3}|[A-Z]{3}[0-9]{4}|[A-Z][0-9][A-Z]-?[0-9][A-Z][0-9]|[A-Z0-9]{2,8}/gi;
  protected readonly contextLabels =
    "(?:License Plate|Plate Number|Registration|Vehicle Registration|License Plate Number|Tag Number|License Plate No\\.|Plate No\\.)";
  protected readonly labelStrings = [
    "License Plate",
    "Plate Number",
    "Registration",
    "Vehicle Registration",
    "License Plate Number",
    "Tag Number",
    "License Plate No.",
    "Plate No.",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    15,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (candidate.length < 2 || candidate.length > 15) {
      return false;
    }

    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["license_plate.format"];
  }
}

export const licensePlateDetector = new LicensePlateDetector();
