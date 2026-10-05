import { ContextDetector, streamMeta } from "../base";

export class CoCedulaDetector extends ContextDetector {
  readonly id = "co_cedula";
  readonly entityType = "co_cedula";
  readonly replacement = "[CO_CEDULA]";

  protected readonly pattern = /\d{6,10}/g;
  protected readonly contextLabels =
    "(?:Colombia|Colombian|Cédula|Cedula|Ciudadanía|CC)";
  protected readonly labelStrings = [
    "Colombia",
    "Colombian",
    "Cédula",
    "Cedula",
    "Ciudadanía",
    "CC",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const coCedulaDetector = new CoCedulaDetector();
