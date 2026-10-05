import { ContextDetector, streamMeta } from "../base";

export class RuSnilsDetector extends ContextDetector {
  readonly id = "ru_snils";
  readonly entityType = "ru_snils";
  readonly replacement = "[RU_SNILS]";

  protected readonly pattern = /\d{3}-\d{3}-\d{3}\s?\d{2}/g;
  protected readonly contextLabels =
    "(?:Russia|Russian|SNILS|СНИЛС|Pension|Пенсионный)";
  protected readonly labelStrings = [
    "Russia",
    "Russian",
    "SNILS",
    "СНИЛС",
    "Pension",
    "Пенсионный",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    14,
    this.leftContext,
    this.rightContext,
  );
}

export const ruSnilsDetector = new RuSnilsDetector();
