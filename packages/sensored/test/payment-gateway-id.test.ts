import { describe, expect, test } from "bun:test";
import { paymentGatewayIdDetector } from "../src/detectors/financial/payment-gateway-id";

describe("payment_gateway_id detector — positive cases", () => {
  test.each([
    ["Stripe token: tok_1234567890abcdefghijklmnopqrstuv", 14, 50],
    ["Payment card_1234567890abcdefghijklmnopqrstuv", 8, 45],
    ["Gateway pm_1234567890abcdefghijklmnopqrstuv", 8, 43],
    ["Token src_1234567890abcdefghijklmnopqrstuv", 6, 42],
    ["Stripe customer: cus_1234567890abcd", 17, 35],
    ["Payment subscription: sub_1234567890abcd", 22, 40],
    ["Payment MERCHANT ID: ABC123456789", 8, 33],
    ["Gateway MERCHANT NO: 12345678ABCD", 8, 33],
    ["Payment MID: ABC123456789", 8, 25],
    ["Gateway TERMINAL ID: ABC123456", 8, 30],
    ["Payment TID: ABC123456", 8, 22],
    ["Gateway POS ID: ABC123456", 8, 25],
  ])("%s", (input, start, end) => {
    const detections = paymentGatewayIdDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "payment_gateway_id",
      entityType: "payment_gateway_id",
      reasons: ["payment_gateway_id.format", "payment_gateway_id.context"],
    });
  });
});

describe("payment_gateway_id detector — negative cases", () => {
  test.each([
    ["tok_1234567890abcdefghijklmnopqrstuv", "no context label"],
    ["Reference: tok_1234567890abcdefghijklmnopqrstuv", "non-approved label"],
    ["Stripe token: tok_123", "token too short — under 24 chars"],
    ["Stripe customer: cus_123", "customer ID too short — under 14 chars"],
    [
      "Stripe subscription: sub_123",
      "subscription ID too short — under 14 chars",
    ],
    ["Payment MERCHANT ID: ABC123", "merchant ID too short — under 8 chars"],
    ["Gateway TERMINAL ID: ABC12", "terminal ID too short — under 6 chars"],
  ])("%s (%s)", (input) => {
    const detections = paymentGatewayIdDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("payment_gateway_id detector — boundary cases", () => {
  test("token exactly 24 chars after prefix", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Stripe token: tok_1234567890abcdefghijklmnopqrst",
    );
    expect(detections).toHaveLength(1);
  });

  test("customer ID exactly 14 chars after prefix", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Stripe customer: cus_1234567890abcd",
    );
    expect(detections).toHaveLength(1);
  });

  test("subscription ID exactly 14 chars after prefix", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Payment subscription: sub_1234567890abcd",
    );
    expect(detections).toHaveLength(1);
  });

  test("merchant ID exactly 8 chars", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Payment MERCHANT ID: ABCD1234",
    );
    expect(detections).toHaveLength(1);
  });

  test("merchant ID exactly 20 chars", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Payment MERCHANT ID: ABCDEFGHIJKLMNOPQRST",
    );
    expect(detections).toHaveLength(1);
  });

  test("terminal ID exactly 6 chars", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Gateway TERMINAL ID: ABC123",
    );
    expect(detections).toHaveLength(1);
  });

  test("terminal ID exactly 16 chars", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Gateway TERMINAL ID: ABCDEFGHIJKLMNOP",
    );
    expect(detections).toHaveLength(1);
  });

  test("terminal ID 17 chars does not match", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Gateway TERMINAL ID: ABCDEFGHIJKLMNOPQ",
    );
    expect(detections).toHaveLength(0);
  });

  test("multiple matches in same text", () => {
    const text =
      "Stripe token: tok_1234567890abcdefghijklmnopqrstuv; customer: cus_1234567890abcd";
    const detections = paymentGatewayIdDetector.detect(text);
    expect(detections).toHaveLength(2);
  });
});

describe("payment_gateway_id detector — adversarial cases", () => {
  test("token embedded in larger word — not matched", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Stripe token: xtok_1234567890abcdefghijklmnopqrstuv",
    );
    expect(detections).toHaveLength(0);
  });

  test("trailing underscore on token — not matched", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Stripe token: tok_1234567890abcdefghijklmnopqrstuv_",
    );
    expect(detections).toHaveLength(0);
  });

  test("underscore adjacent on merchant ID — not matched", () => {
    const detections = paymentGatewayIdDetector.detect(
      "Payment MERCHANT ID: _ABCD1234",
    );
    expect(detections).toHaveLength(0);
  });

  test("empty string", () => {
    const detections = paymentGatewayIdDetector.detect("");
    expect(detections).toHaveLength(0);
  });

  test("context label only, no gateway ID", () => {
    const detections = paymentGatewayIdDetector.detect("Stripe token: ");
    expect(detections).toHaveLength(0);
  });
});
