import { ContextDetector, streamMeta } from "../base";

export class KeKraPinDetector extends ContextDetector {
  readonly id = "ke_kra_pin";
  readonly entityType = "ke_kra_pin";
  readonly replacement = "[KE_KRA_PIN]";

  protected readonly pattern = /A\d{9}[A-Z]/g;
  protected readonly contextLabels =
    "(?:KRA|Kenya|Revenue|Authority|Tax|PIN|Taxpayer)";
  protected readonly labelStrings = [
    "KRA",
    "Kenya",
    "Revenue",
    "Authority",
    "Tax",
    "PIN",
    "Taxpayer",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const keKraPinDetector = new KeKraPinDetector();
