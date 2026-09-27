import { describe, expect, test } from "bun:test";
import { investmentAccountDetector } from "../src/detectors/financial/investment-account";

describe("investment_account detector — positive cases", () => {
  test.each([
    ["Account ISA NO: AB123456", 8, 24],
    ["Fund SIPP NO: 123456AB", 5, 22],
    ["Account INV NO: AB123456", 8, 24],
    ["Fund INVESTMENT NO: 123456AB", 5, 28],
    ["Account PENSION NO: AB123456", 8, 28],
    ["Fund 401K NO: 123456AB", 5, 22],
    ["Account IRA NO: AB123456", 8, 24],
    ["Fund TRADING NO: AB123456", 5, 25],
    ["Account BROKERAGE NO: 123456AB", 8, 30],
    ["Fund STOCK NO: AB123456", 5, 23],
    ["Account LOAN NO: AB123456", 8, 25],
    ["Fund MORTGAGE NO: 123456AB", 5, 26],
    ["Account CREDIT NO: AB123456", 8, 27],
  ])("%s", (input, start, end) => {
    const detections = investmentAccountDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      start,
      end,
      ruleId: "investment_account",
      entityType: "investment_account",
      reasons: ["investment_account.format", "investment_account.context"],
    });
  });
});

describe("investment_account detector — negative cases", () => {
  test.each([
    ["AB123456", "no context label"],
    ["Reference: AB123456", "non-approved label"],
    ["Account ISA NO: AB1", "too short"],
    ["myAccount ISA NO: AB123456", "label not whole — my prefix"],
    ["Fund TRADING NO: AB1", "too short for TRADING pattern"],
    ["Account LOAN NO: AB1", "too short for LOAN pattern"],
  ])("%s (%s)", (input) => {
    const detections = investmentAccountDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("investment_account detector — boundary cases", () => {
  test("ISA pattern minimum length (7 alphanumeric)", () => {
    const detections = investmentAccountDetector.detect(
      "Account ISA NO: AB12345",
    );
    expect(detections).toHaveLength(1);
  });

  test("TRADING pattern exactly 6 chars", () => {
    const detections = investmentAccountDetector.detect(
      "Fund TRADING NO: AB1234",
    );
    expect(detections).toHaveLength(1);
  });

  test("TRADING pattern exactly 14 chars", () => {
    const detections = investmentAccountDetector.detect(
      "Fund TRADING NO: ABCDEFGHIJKLMN",
    );
    expect(detections).toHaveLength(1);
  });

  test("TRADING pattern 15 chars does not match", () => {
    const detections = investmentAccountDetector.detect(
      "Fund TRADING NO: ABCDEFGHIJKLMNO",
    );
    expect(detections).toHaveLength(0);
  });

  test("LOAN pattern exactly 6 chars", () => {
    const detections = investmentAccountDetector.detect(
      "Account LOAN NO: AB1234",
    );
    expect(detections).toHaveLength(1);
  });

  test("LOAN pattern exactly 16 chars", () => {
    const detections = investmentAccountDetector.detect(
      "Account LOAN NO: ABCDEFGHIJKLMNOP",
    );
    expect(detections).toHaveLength(1);
  });

  test("multiple matches in same text", () => {
    const text = "Account ISA NO: AB123456; Fund LOAN NO: CD654321";
    const detections = investmentAccountDetector.detect(text);
    expect(detections).toHaveLength(2);
  });
});

describe("investment_account detector — adversarial cases", () => {
  test("embedded in larger word — not matched", () => {
    const detections = investmentAccountDetector.detect(
      "xAccount ISA NO: AB123456",
    );
    expect(detections).toHaveLength(0);
  });

  test("trailing letter after max length — not matched", () => {
    const detections = investmentAccountDetector.detect(
      "Account ISA NO: ABCDEFGHIJKLMNOPQRSTUV",
    );
    expect(detections).toHaveLength(0);
  });

  test("underscore adjacent — not matched", () => {
    const detections = investmentAccountDetector.detect(
      "Account ISA NO: _AB123456",
    );
    expect(detections).toHaveLength(0);
  });

  test("empty string", () => {
    const detections = investmentAccountDetector.detect("");
    expect(detections).toHaveLength(0);
  });

  test("context label only, no account number", () => {
    const detections = investmentAccountDetector.detect("Account ISA NO: ");
    expect(detections).toHaveLength(0);
  });
});
