import { ContextDetector, streamMeta } from "../base";

function inseeValid(candidate: string): boolean {
  const cleaned = candidate.replace(/\s/g, "");

  if (cleaned.length !== 15) {
    return false;
  }

  const first13 = cleaned.slice(0, 13);
  const controlKey = cleaned.slice(13, 15);

  const num = Number.parseInt(first13, 10);
  const expected = 97 - (num % 97);
  const expectedStr = expected.toString().padStart(2, "0");

  return expectedStr === controlKey;
}

export class FrInseeDetector extends ContextDetector {
  readonly id = "fr_insee";
  readonly entityType = "fr_insee";
  readonly replacement = "[FR_INSEE]";

  protected readonly pattern = /\d{13} ?\d{2}/g;
  protected readonly contextLabels =
    "(?:INSEE|NIR|Numéro de Sécurité Sociale|Social Security Number|Numéro INSEE)";
  protected readonly labelStrings = [
    "INSEE",
    "NIR",
    "Numéro de Sécurité Sociale",
    "Social Security Number",
    "Numéro INSEE",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    15,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!inseeValid(candidate)) {
      return false;
    }

    return ["fr_insee.checksum"];
  }
}

export const frInseeDetector = new FrInseeDetector();
