import { ContextDetector, streamMeta } from "../base";

export class CardDataDetector extends ContextDetector {
  readonly id = "card_data";
  readonly entityType = "card_data";
  readonly replacement = "[CARD_DATA]";

  protected readonly pattern =
    /%B\d{13,19}\^[^^]+\^\d{4}\d{3}[^?]+\?|;\d{13,19}=\d{4}\d{3}[^?]+\?|(?:CVV|CVC|CVV2|CID|CSC)[:\s]+\d{3,4}|(?:EXP(?:IRY|IRATION)?|VALID\s+THRU)[:\s]+\d{2}[/-]\d{2,4}/gi;
  protected readonly contextLabels =
    "(?:Card|Payment|Credit|Debit|Visa|Mastercard|Amex|CVV|CVC|Expiry|Track|Magnetic|Stripe)";
  protected readonly labelStrings = [
    "Card",
    "Payment",
    "Credit",
    "Debit",
    "Visa",
    "Mastercard",
    "Amex",
    "CVV",
    "CVC",
    "Expiry",
    "Track",
    "Magnetic",
    "Stripe",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    100,
    this.leftContext,
    this.rightContext,
  );
}

export const cardDataDetector = new CardDataDetector();
