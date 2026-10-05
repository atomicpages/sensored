import { ContextDetector, streamMeta } from "../base";

export class IdNpwpDetector extends ContextDetector {
  readonly id = "id_npwp";
  readonly entityType = "id_npwp";
  readonly replacement = "[ID_NPWP]";

  protected readonly pattern = /\d{2}\.?\d{3}\.?\d{3}\.?\d[-.]?\d{3}\.?\d{3}/g;
  protected readonly contextLabels = "(?:Indonesia|NPWP|Tax|Pajak|Wajib Pajak)";
  protected readonly labelStrings = [
    "Indonesia",
    "NPWP",
    "Tax",
    "Pajak",
    "Wajib Pajak",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    20,
    this.leftContext,
    this.rightContext,
  );
}

export const idNpwpDetector = new IdNpwpDetector();
