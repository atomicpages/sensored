import { ContextDetector, streamMeta } from "../base";

export class UkBankAccountDetector extends ContextDetector {
  readonly id = "uk_bank_account";
  readonly entityType = "uk_bank_account";
  readonly replacement = "[UK_BANK_ACCOUNT]";

  protected readonly pattern = /\d{8}/g;
  protected readonly contextLabels =
    "(?:account[- ]?(?:no|number)|acct[- ]?(?:no|number)|bank[- ]?account)";
  protected readonly labelStrings = [
    "account no",
    "account number",
    "acct no",
    "acct number",
    "bank account",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(8, this.leftContext, this.rightContext);
}

export const ukBankAccountDetector = new UkBankAccountDetector();
