import { ContextDetector, streamMeta } from "../base";

export class AddressDetector extends ContextDetector {
  readonly id = "address";
  readonly entityType = "address";
  readonly replacement = "[ADDRESS]";

  protected readonly pattern =
    /\d{1,6}[ \t]+[A-Z][A-Za-z0-9.'\u2019-]*(?:[ \t]+[A-Z0-9][A-Za-z0-9.'\u2019-]*){0,4}[ \t]+(?:St(?:reet)?|Ave(?:nue)?|Rd|Road|Blvd|Boulevard|Lane|Ln|Dr(?:ive)?|Ct|Court|Pl(?:ace)?|Sq(?:uare)?|Ter(?:race)?|Cir(?:cle)?|Way|Pkwy|Parkway|Hwy|Highway)/gi;
  protected readonly contextLabels =
    "(?:Address|Street|Home Address|Mailing Address|Residence|Postal Address)";
  protected readonly labelStrings = [
    "Address",
    "Street",
    "Home Address",
    "Mailing Address",
    "Residence",
    "Postal Address",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    120,
    this.leftContext,
    this.rightContext,
  );
}

export const addressDetector = new AddressDetector();
