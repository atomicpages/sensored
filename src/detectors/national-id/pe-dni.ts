import { ContextDetector, streamMeta } from "../base";

export class PeDniDetector extends ContextDetector {
  readonly id = "pe_dni";
  readonly entityType = "pe_dni";
  readonly replacement = "[PE_DNI]";

  protected readonly pattern = /\d{8}/g;
  protected readonly contextLabels =
    "(?:Peru|Peruvian|Perú|Peruano|DNI|Documento Nacional|Identidad|RENIEC)";
  protected readonly labelStrings = [
    "Peru",
    "Peruvian",
    "Perú",
    "Peruano",
    "DNI",
    "Documento Nacional",
    "Identidad",
    "RENIEC",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const peDniDetector = new PeDniDetector();
