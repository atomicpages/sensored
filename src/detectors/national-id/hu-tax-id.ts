import { ContextDetector, streamMeta } from "../base";

export class HuTaxIdDetector extends ContextDetector {
  readonly id = "hu_tax_id";
  readonly entityType = "hu_tax_id";
  readonly replacement = "[HU_TAX_ID]";

  protected readonly pattern = /\d{10}/g;
  protected readonly contextLabels =
    "(?:Hungarian|Magyar|Adó|Tax|Adóazonosító)";
  protected readonly labelStrings = [
    "Hungarian",
    "Magyar",
    "Adó",
    "Tax",
    "Adóazonosító",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    10,
    this.leftContext,
    this.rightContext,
  );
}

export const huTaxIdDetector = new HuTaxIdDetector();
