import { ContextDetector, streamMeta } from "../base";

function ecCedulaValid(candidate: string): boolean {
  const province = parseInt(candidate.slice(0, 2), 10);
  const thirdDigit = parseInt(candidate[2]!, 10);

  if (province < 1 || province > 24) {
    return false;
  }

  if (thirdDigit > 6 && thirdDigit !== 9) {
    return false;
  }

  return true;
}

export class EcCedulaDetector extends ContextDetector {
  readonly id = "ec_cedula";
  readonly entityType = "ec_cedula";
  readonly replacement = "[EC_CEDULA]";

  protected readonly pattern = /\d{10}/g;
  protected readonly contextLabels =
    "(?:Ecuador|Ecuadorian|Cédula|Cedula|Identidad)";
  protected readonly labelStrings = [
    "Ecuador",
    "Ecuadorian",
    "Cédula",
    "Cedula",
    "Identidad",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!ecCedulaValid(candidate)) {
      return false;
    }

    return ["ec_cedula.format"];
  }
}

export const ecCedulaDetector = new EcCedulaDetector();
