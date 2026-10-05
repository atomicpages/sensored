import { ContextDetector, streamMeta } from "../base";

export class RuPassportDetector extends ContextDetector {
  readonly id = "ru_passport";
  readonly entityType = "ru_passport";
  readonly replacement = "[RU_PASSPORT]";

  protected readonly pattern = /\d{4}\s?\d{6}/g;
  protected readonly contextLabels =
    "(?:Russia|Russian|Passport|Паспорт|Российский)";
  protected readonly labelStrings = [
    "Russia",
    "Russian",
    "Passport",
    "Паспорт",
    "Российский",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const ruPassportDetector = new RuPassportDetector();
