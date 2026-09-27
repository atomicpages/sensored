import { ContextDetector, streamMeta } from "../base";

export class VeRifDetector extends ContextDetector {
  readonly id = "ve_rif";
  readonly entityType = "ve_rif";
  readonly replacement = "[VE_RIF]";

  protected readonly pattern = /[VEJG]-\d{8,9}-\d/gi;
  protected readonly contextLabels = "(?:Venezuela|RIF|Tax|SENIAT|Tributario)";
  protected readonly labelStrings = [
    "Venezuela",
    "RIF",
    "Tax",
    "SENIAT",
    "Tributario",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    13,
    this.leftContext,
    this.rightContext,
  );
}

export const veRifDetector = new VeRifDetector();
