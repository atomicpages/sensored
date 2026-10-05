import { ContextDetector, streamMeta } from "../base";

export class TmPassportDetector extends ContextDetector {
  readonly id = "tm_passport";
  readonly entityType = "tm_passport";
  readonly replacement = "[TM_PASSPORT]";

  protected readonly pattern = /[A-Z]\d{7}/g;
  protected readonly contextLabels =
    "(?:Turkmen|Turkmenistan|Passport|Pasport)";
  protected readonly labelStrings = [
    "Turkmen",
    "Turkmenistan",
    "Passport",
    "Pasport",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const tmPassportDetector = new TmPassportDetector();
