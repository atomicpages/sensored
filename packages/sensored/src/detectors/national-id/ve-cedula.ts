import { ContextDetector, streamMeta } from "../base";

export class VeCedulaDetector extends ContextDetector {
  readonly id = "ve_cedula";
  readonly entityType = "ve_cedula";
  readonly replacement = "[VE_CEDULA]";

  protected readonly pattern = /[VE]-\d{1,8}/gi;
  protected readonly contextLabels =
    "(?:Venezuela|Venezuelan|Cédula|Cedula|Identidad|CI)";
  protected readonly labelStrings = [
    "Venezuela",
    "Venezuelan",
    "Cédula",
    "Cedula",
    "Identidad",
    "CI",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const veCedulaDetector = new VeCedulaDetector();
