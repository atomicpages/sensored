import { ContextDetector, streamMeta } from "../base";

function rucValid(candidate: string): boolean {
  const prefix = candidate.slice(0, 2);

  return (
    prefix === "10" || prefix === "15" || prefix === "17" || prefix === "20"
  );
}

export class PeRucDetector extends ContextDetector {
  readonly id = "pe_ruc";
  readonly entityType = "pe_ruc";
  readonly replacement = "[PE_RUC]";

  protected readonly pattern = /\d{11}/g;
  protected readonly contextLabels = "(?:Peru|Perú|RUC|Tax|SUNAT|Tributario)";
  protected readonly labelStrings = [
    "Peru",
    "Perú",
    "RUC",
    "Tax",
    "SUNAT",
    "Tributario",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (!rucValid(candidate)) {
      return false;
    }

    return ["pe_ruc.format"];
  }
}

export const peRucDetector = new PeRucDetector();
