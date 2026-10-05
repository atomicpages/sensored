import { ContextDetector, streamMeta } from "../base";

function charValue(c: string): number {
  if (c >= "0" && c <= "9") {
    return c.charCodeAt(0) - 48;
  }

  return c.toUpperCase().charCodeAt(0) - 48;
}

function upsValid(candidate: string): boolean {
  const chars = candidate.slice(2);

  if (chars.length !== 16) {
    return false;
  }

  const checkDigit = parseInt(chars[15]!, 10);

  if (Number.isNaN(checkDigit)) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 15; i++) {
    const value = charValue(chars[i]!);
    const weight = i % 2 === 0 ? 3 : 1;
    const product = value * weight;
    sum += Math.floor(product / 10) + (product % 10);
  }

  return (10 - (sum % 10)) % 10 === checkDigit;
}

function fedexExpressValid(candidate: string): boolean {
  if (candidate.length !== 12) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += parseInt(candidate[i]!, 10) * (i + 1);
  }

  const checkDigit = sum % 11;
  const expected = checkDigit === 10 ? 0 : checkDigit;

  return expected === parseInt(candidate[11]!, 10);
}

function mod10Valid(candidate: string): boolean {
  const len = candidate.length;
  let sum = 0;

  for (let i = 0; i < len - 1; i++) {
    const d = parseInt(candidate[i]!, 10);
    const weight = (len - 2 - i) % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }

  return (10 - (sum % 10)) % 10 === parseInt(candidate[len - 1]!, 10);
}

function dhlValid(candidate: string): boolean {
  if (candidate.length !== 10) {
    return false;
  }

  const num = parseInt(candidate.slice(0, 9), 10);

  return num % 7 === parseInt(candidate[9]!, 10);
}

export class TrackingNumberDetector extends ContextDetector {
  readonly id = "tracking_number";
  readonly entityType = "tracking_number";
  readonly replacement = "[TRACKING_NUMBER]";

  protected readonly pattern = /1Z[A-Z0-9]{16}|\d{20,22}|\d{15}|\d{12}|\d{10}/g;
  protected readonly contextLabels =
    "(?:Tracking[- ]?(?:Number|No\\.?|ID)|Package[- ]?ID|Shipment[- ]?ID|Waybill[- ]?No\\.?|Consignment[- ]?No\\.?)";
  protected readonly labelStrings = [
    "Tracking Number",
    "Tracking No.",
    "Tracking No",
    "Tracking ID",
    "Package ID",
    "Shipment ID",
    "Waybill No.",
    "Waybill No",
    "Consignment No.",
    "Consignment No",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    22,
    this.leftContext,
    this.rightContext,
  );

  protected override validate(candidate: string): false | readonly string[] {
    if (candidate.startsWith("1Z")) {
      if (upsValid(candidate)) {
        return ["tracking_number.ups_checksum", "tracking_number.format"];
      }

      return false;
    }

    if (candidate.length === 10) {
      if (dhlValid(candidate)) {
        return ["tracking_number.dhl_checksum", "tracking_number.format"];
      }

      return false;
    }

    if (candidate.length === 12) {
      if (fedexExpressValid(candidate)) {
        return [
          "tracking_number.fedex_express_checksum",
          "tracking_number.format",
        ];
      }

      return false;
    }

    if (candidate.length === 15) {
      if (mod10Valid(candidate)) {
        return [
          "tracking_number.fedex_ground_checksum",
          "tracking_number.format",
        ];
      }

      return false;
    }

    if (candidate.length >= 20 && candidate.length <= 22) {
      if (mod10Valid(candidate)) {
        return ["tracking_number.usps_checksum", "tracking_number.format"];
      }

      return false;
    }

    return false;
  }
}

export const trackingNumberDetector = new TrackingNumberDetector();
