import { ContextDetector, streamMeta } from "../base";

export class UaPassportDetector extends ContextDetector {
  readonly id = "ua_passport";
  readonly entityType = "ua_passport";
  readonly replacement = "[UA_PASSPORT]";

  protected readonly pattern = /[A-Z]{2}\d{6}/g;
  protected readonly contextLabels =
    "(?:Ukrainian|Passport|Паспорт|Український)";
  protected readonly labelStrings = [
    "Ukrainian",
    "Passport",
    "Паспорт",
    "Український",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const uaPassportDetector = new UaPassportDetector();
