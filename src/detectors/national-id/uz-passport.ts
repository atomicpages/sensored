import { ContextDetector, streamMeta } from "../base";

export class UzPassportDetector extends ContextDetector {
  readonly id = "uz_passport";
  readonly entityType = "uz_passport";
  readonly replacement = "[UZ_PASSPORT]";

  protected readonly pattern = /[A-Z]{2}\d{7}/g;
  protected readonly contextLabels = "(?:Uzbek|Uzbekistan|Passport|Pasport)";
  protected readonly labelStrings = [
    "Uzbek",
    "Uzbekistan",
    "Passport",
    "Pasport",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);
}

export const uzPassportDetector = new UzPassportDetector();
