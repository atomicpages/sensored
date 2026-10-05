import { ContextDetector, streamMeta } from "../base";

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function dniValid(candidate: string): boolean {
  const upper = candidate.toUpperCase();

  if (upper.length !== 9) {
    return false;
  }

  const number = Number.parseInt(upper.slice(0, 8), 10);
  const letter = upper.slice(8, 9);

  if (Number.isNaN(number)) {
    return false;
  }

  const expectedLetter = DNI_LETTERS[number % 23];

  return expectedLetter === letter;
}

export class EsDniDetector extends ContextDetector {
  readonly id = "es_dni";
  readonly entityType = "es_dni";
  readonly replacement = "[ES_DNI]";

  protected readonly pattern = /\d{8}[A-Z]/gi;
  protected readonly contextLabels =
    "(?:DNI|Documento Nacional de Identidad|Spanish ID|National ID)";
  protected readonly labelStrings = [
    "DNI",
    "Documento Nacional de Identidad",
    "Spanish ID",
    "National ID",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(9, this.leftContext, this.rightContext);

  protected override validate(candidate: string): false | readonly string[] {
    if (!dniValid(candidate)) {
      return false;
    }

    return ["es_dni.checksum"];
  }
}

export const esDniDetector = new EsDniDetector();
