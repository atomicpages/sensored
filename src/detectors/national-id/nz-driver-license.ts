import { ContextDetector, streamMeta } from "../base";

export class NzDriverLicenseDetector extends ContextDetector {
  readonly id = "nz_driver_license";
  readonly entityType = "nz_driver_license";
  readonly replacement = "[NZ_DRIVER_LICENSE]";

  protected readonly pattern = /[A-Z]{2}\d{6}/gi;
  protected readonly contextLabels =
    "(?:New Zealand|NZ|Kiwi|Driver License|Driver Licence|Driver|License|Licence)";
  protected readonly labelStrings = [
    "New Zealand",
    "NZ",
    "Kiwi",
    "Driver License",
    "Driver Licence",
    "Driver",
    "License",
    "Licence",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const nzDriverLicenseDetector = new NzDriverLicenseDetector();
