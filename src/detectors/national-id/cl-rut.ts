import { ContextDetector, streamMeta } from "../base";

function rutValid(candidate: string): boolean {
  const clean = candidate.replace(/[.-]/g, "");

  if (clean.length < 8 || clean.length > 9) {
    return false;
  }

  const body = clean.slice(0, -1);
  const checkDigit = clean.slice(-1).toUpperCase();

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]!, 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = sum % 11;
  const expected =
    remainder === 0 ? "0" : remainder === 1 ? "K" : String(11 - remainder);

  return checkDigit === expected;
}

export class ClRutDetector extends ContextDetector {
  readonly id = "cl_rut";
  readonly entityType = "cl_rut";
  readonly replacement = "[CL_RUT]";

  protected readonly pattern = /\d{1,2}\.\d{3}\.\d{3}-[\dKk]/gi;
  protected readonly contextLabels =
    "(?:Chile|Chilean|RUT|Rol Único|Tributario|Cédula)";
  protected readonly labelStrings = [
    "Chile",
    "Chilean",
    "RUT",
    "Rol Único",
    "Tributario",
    "Cédula",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    12,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!rutValid(candidate)) {
      return false;
    }

    return ["cl_rut.checksum"];
  }
}

export const clRutDetector = new ClRutDetector();
