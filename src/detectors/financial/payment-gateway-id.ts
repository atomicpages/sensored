import { ContextDetector, streamMeta } from "../base";

export class PaymentGatewayIdDetector extends ContextDetector {
  readonly id = "payment_gateway_id";
  readonly entityType = "payment_gateway_id";
  readonly replacement = "[PAYMENT_GATEWAY_ID]";

  protected readonly pattern =
    /(?:tok|card|pm|src)_[a-zA-Z0-9]{24,}|cus_[a-zA-Z0-9]{14,}|sub_[a-zA-Z0-9]{14,}|(?:MERCHANT|MID)[-\s]?(?:ID|NO|NUM(?:BER)?)?[-\s]?[:#]?\s*[A-Z0-9]{8,20}|(?:TERMINAL|TID|POS)[-\s]?(?:ID|NO|NUM(?:BER)?)?[-\s]?[:#]?\s*[A-Z0-9]{6,16}/gi;
  protected readonly contextLabels =
    "(?:Stripe|Payment|Gateway|Token|Customer|Subscription|Merchant|Terminal|POS)";
  protected readonly labelStrings = [
    "Stripe",
    "Payment",
    "Gateway",
    "Token",
    "Customer",
    "Subscription",
    "Merchant",
    "Terminal",
    "POS",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    50,
    this.leftContext,
    this.rightContext,
  );
}

export const paymentGatewayIdDetector = new PaymentGatewayIdDetector();
