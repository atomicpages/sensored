import { ContextDetector, streamMeta } from "../base";

export class UyCedulaDetector extends ContextDetector {
  readonly id = "uy_cedula";
  readonly entityType = "uy_cedula";
  readonly replacement = "[UY_CEDULA]";

  protected readonly pattern = /\d\.\d{3}\.\d{3}-\d/g;
  protected readonly contextLabels =
    "(?:Uruguay|Uruguayan|Cédula|Cedula|Identidad)";
  protected readonly labelStrings = [
    "Uruguay",
    "Uruguayan",
    "Cédula",
    "Cedula",
    "Identidad",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const uyCedulaDetector = new UyCedulaDetector();
