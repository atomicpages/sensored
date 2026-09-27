import { ContextDetector, streamMeta } from "../base";

export class KgPinDetector extends ContextDetector {
  readonly id = "kg_pin";
  readonly entityType = "kg_pin";
  readonly replacement = "[KG_PIN]";

  protected readonly pattern = /\d{14}/g;
  protected readonly contextLabels =
    "(?:Kyrgyz|Kyrgyzstan|PIN|Personal ID|Личный|Номер)";
  protected readonly labelStrings = [
    "Kyrgyz",
    "Kyrgyzstan",
    "PIN",
    "Personal ID",
    "Личный",
    "Номер",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    14,
    this.leftContext,
    this.rightContext,
  );
}

export const kgPinDetector = new KgPinDetector();
