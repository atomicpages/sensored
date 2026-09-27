import { ContextDetector, streamMeta } from "../base";

export class IdNikDetector extends ContextDetector {
  readonly id = "id_nik";
  readonly entityType = "id_nik";
  readonly replacement = "[ID_NIK]";

  protected readonly pattern = /\d{16}/g;
  protected readonly contextLabels =
    "(?:Indonesia|Indonesian|NIK|Nomor Induk|KTP|National ID)";
  protected readonly labelStrings = [
    "Indonesia",
    "Indonesian",
    "NIK",
    "Nomor Induk",
    "KTP",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    16,
    this.leftContext,
    this.rightContext,
  );
}

export const idNikDetector = new IdNikDetector();
