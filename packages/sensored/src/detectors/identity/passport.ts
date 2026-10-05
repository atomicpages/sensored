import { ContextDetector, streamMeta } from "../base";

export class PassportDetector extends ContextDetector {
  readonly id = "passport";
  readonly entityType = "passport";
  readonly replacement = "[PASSPORT]";

  protected readonly pattern = /[A-Z]{2}\d{7}|[A-Z]{2}\d{6}|\d{9}/gi;
  protected readonly contextLabels =
    "(?:Passport Number|Passport No\\.|Passport)";
  protected readonly labelStrings = [
    "Passport Number",
    "Passport No.",
    "Passport",
  ] as const;
  protected readonly leftContext = 30;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);
}

export const passportDetector = new PassportDetector();
