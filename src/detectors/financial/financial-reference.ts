import { ContextDetector, streamMeta } from "../base";

export class FinancialReferenceDetector extends ContextDetector {
  readonly id = "financial_reference";
  readonly entityType = "financial_reference";
  readonly replacement = "[FINANCIAL_REFERENCE]";

  protected readonly pattern =
    /(?:TXN|TX|TRANS(?:ACTION)?)[-\s]?(?:ID|NO|NUM(?:BER)?|REF)?[-\s]?[:#]?\s*[A-Z0-9]{8,20}|(?:WIRE|TRANSFER|REMITTANCE)[-\s]?(?:REF(?:ERENCE)?|NO|NUM(?:BER)?|ID)?[-\s]?[:#]?\s*[A-Z0-9]{8,20}|(?:STATEMENT|STMT)[-\s]?(?:REF(?:ERENCE)?|NO|NUM(?:BER)?|ID)?[-\s]?[:#]?\s*[A-Z0-9]{6,15}|(?:PAYMENT|PAY)[-\s]?(?:REF(?:ERENCE)?|NO|NUM(?:BER)?|ID)?[-\s]?[:#]?\s*[A-Z0-9]{8,20}/gi;
  protected readonly contextLabels =
    "(?:Transaction|TXN|Wire|Transfer|Remittance|Statement|Payment|Financial|Banking)";
  protected readonly labelStrings = [
    "Transaction",
    "TXN",
    "Wire",
    "Transfer",
    "Remittance",
    "Statement",
    "Payment",
    "Financial",
    "Banking",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    30,
    this.leftContext,
    this.rightContext,
  );
}

export const financialReferenceDetector = new FinancialReferenceDetector();
