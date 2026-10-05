import { ContextDetector, streamMeta } from "../base";

export class DriversLicenseDetector extends ContextDetector {
  readonly id = "drivers_license";
  readonly entityType = "drivers_license";
  readonly replacement = "[DRIVERS_LICENSE]";

  protected readonly pattern = /[A-Z0-9]{6,16}/gi;
  protected readonly contextLabels =
    "(?:Driver['\\u2019]s License|Driving Licence|License No\\.|DL)";
  protected readonly labelStrings = [
    "Driver's License",
    "Driving Licence",
    "License No.",
    "DL",
  ] as const;
  protected readonly leftContext = 30;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    16,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!/\d/.test(candidate)) {
      return false;
    }

    return ["drivers_license.format"];
  }
}

export const driversLicenseDetector = new DriversLicenseDetector();
