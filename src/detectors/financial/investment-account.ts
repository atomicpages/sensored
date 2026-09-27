import { ContextDetector, streamMeta } from "../base";

export class InvestmentAccountDetector extends ContextDetector {
  readonly id = "investment_account";
  readonly entityType = "investment_account";
  readonly replacement = "[INVESTMENT_ACCOUNT]";

  protected readonly pattern =
    /(?:ISA|SIPP|INV(?:ESTMENT)?|PENSION|401K|IRA)[-\s]*(?:ACCOUNT|ACCT|A\/C)?[-\s]*(?:NO|NUM(?:BER)?)?[-\s.:#]*[A-Z0-9](?:[A-Z0-9][\s./-]?){5,18}[A-Z0-9]|(?:TRADING|BROKERAGE|STOCK)[-\s]?(?:ACCOUNT|ACCT|A\/C)?[-\s]?(?:NO|NUM(?:BER)?)?[-\s]?[:#]?\s*[A-Z0-9]{6,14}|(?:LOAN|MORTGAGE|CREDIT)[-\s]?(?:ACCOUNT|ACCT|A\/C)?[-\s]?(?:NO|NUM(?:BER)?)?[-\s]?[:#]?\s*[A-Z0-9]{6,16}/gi;
  protected readonly contextLabels =
    "(?:ISA|SIPP|Invest|Pension|401K|IRA|Account|Fund|Trading|Brokerage|Stock|Loan|Mortgage|Credit)";
  protected readonly labelStrings = [
    "ISA",
    "SIPP",
    "Invest",
    "Pension",
    "401K",
    "IRA",
    "Account",
    "Fund",
    "Trading",
    "Brokerage",
    "Stock",
    "Loan",
    "Mortgage",
    "Credit",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    30,
    this.leftContext,
    this.rightContext,
  );
}

export const investmentAccountDetector = new InvestmentAccountDetector();
