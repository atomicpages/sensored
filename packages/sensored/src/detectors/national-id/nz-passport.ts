import { ContextDetector, streamMeta } from "../base";

export class NzPassportDetector extends ContextDetector {
  readonly id = "nz_passport";
  readonly entityType = "nz_passport";
  readonly replacement = "[NZ_PASSPORT]";

  protected readonly pattern = /[A-Z]{2}\d{6}/gi;
  protected readonly contextLabels =
    "(?:New Zealand|NZ|Passport|Travel Document)";
  protected readonly labelStrings = [
    "New Zealand",
    "NZ",
    "Passport",
    "Travel Document",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const nzPassportDetector = new NzPassportDetector();
