import { ContextDetector, streamMeta } from "../base";

export class CoNitDetector extends ContextDetector {
  readonly id = "co_nit";
  readonly entityType = "co_nit";
  readonly replacement = "[CO_NIT]";

  protected readonly pattern = /\d{9}-\d/g;
  protected readonly contextLabels =
    "(?:Colombia|NIT|Tax|Impuesto|Tributario|Empresa)";
  protected readonly labelStrings = [
    "Colombia",
    "NIT",
    "Tax",
    "Impuesto",
    "Tributario",
    "Empresa",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const coNitDetector = new CoNitDetector();
