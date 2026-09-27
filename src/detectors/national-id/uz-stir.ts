import { ContextDetector, streamMeta } from "../base";

export class UzStirDetector extends ContextDetector {
  readonly id = "uz_stir";
  readonly entityType = "uz_stir";
  readonly replacement = "[UZ_STIR]";

  protected readonly pattern = /\d{9}/g;
  protected readonly contextLabels = "(?:Uzbek|Uzbekistan|STIR|Tax|INN|Soliq)";
  protected readonly labelStrings = [
    "Uzbek",
    "Uzbekistan",
    "STIR",
    "Tax",
    "INN",
    "Soliq",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);
}

export const uzStirDetector = new UzStirDetector();
