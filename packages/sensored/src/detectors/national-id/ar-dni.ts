import { ContextDetector, streamMeta } from "../base";

export class ArDniDetector extends ContextDetector {
  readonly id = "ar_dni";
  readonly entityType = "ar_dni";
  readonly replacement = "[AR_DNI]";

  protected readonly pattern = /\d{7,8}/g;
  protected readonly contextLabels =
    "(?:Argentina|Argentin|DNI|Documento Nacional|Identidad)";
  protected readonly labelStrings = [
    "Argentina",
    "Argentin",
    "DNI",
    "Documento Nacional",
    "Identidad",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const arDniDetector = new ArDniDetector();
