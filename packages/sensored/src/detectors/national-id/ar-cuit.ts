import { ContextDetector, streamMeta } from "../base";

export class ArCuitDetector extends ContextDetector {
  readonly id = "ar_cuit";
  readonly entityType = "ar_cuit";
  readonly replacement = "[AR_CUIT]";

  protected readonly pattern = /\d{2}-\d{8}-\d/g;
  protected readonly contextLabels =
    "(?:Argentina|CUIT|CUIL|Tax|Impuesto|Tributario)";
  protected readonly labelStrings = [
    "Argentina",
    "CUIT",
    "CUIL",
    "Tax",
    "Impuesto",
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

export const arCuitDetector = new ArCuitDetector();
