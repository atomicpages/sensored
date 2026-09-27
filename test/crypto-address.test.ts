import { describe, expect, test } from "bun:test";
import { cryptoAddressDetector } from "../src/detectors/crypto/crypto-address";

describe("crypto_address detector — positive cases", () => {
  test.each([
    ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "BTC P2PKH"],
    ["1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "BTC P2PKH 2"],
    ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "BTC P2SH"],
    ["bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "BTC SegWit"],
    [
      "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpyxxf3qccfm7",
      "BTC SegWit long",
    ],
    ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e", "ETH"],
    ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "ETH 2"],
    ["Lfm2M5m5P5QGefi2DMPTfTL5SLmv7DivfNa", "LTC legacy L"],
    ["Mfm2M5m5P5QGefi2DMPTfTL5SLmv7DivfNa", "LTC legacy M"],
    ["ltc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "LTC SegWit"],
    ["4" + "A".repeat(93), "XMR"],
    ["rDsbeomare4J1k6t6U8Z2J5J2J2J2J2J2J", "XRP"],
    ["addr1" + "a".repeat(50), "ADA minimum"],
    ["7" + "x".repeat(31), "SOL minimum 32 chars"],
    ["7" + "x".repeat(43), "SOL maximum 44 chars"],
    ["tz1" + "K".repeat(33), "XTZ tz1"],
    ["tz2" + "K".repeat(33), "XTZ tz2"],
    ["tz3" + "K".repeat(33), "XTZ tz3"],
    ["tz4" + "K".repeat(33), "XTZ tz4"],
    ["KT1" + "K".repeat(33), "XTZ KT1"],
    ["bnb1" + "a".repeat(38), "BNB"],
  ])("%s (%s)", (input) => {
    const detections = cryptoAddressDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "crypto_address",
      entityType: "crypto_address",
      reasons: ["crypto_address.format"],
    });
    expect(detections[0]?.start).toBe(0);
    expect(detections[0]?.end).toBe(input.length);
  });
});

describe("crypto_address detector — embedded in text", () => {
  test("BTC address in a sentence", () => {
    const text = "Send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa please";
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(8);
    expect(detections[0]?.end).toBe(42);
  });

  test("ETH address in a sentence", () => {
    const text = "Wallet: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(8);
    expect(detections[0]?.end).toBe(50);
  });

  test("multiple addresses in text", () => {
    const text =
      "BTC: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa ETH: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(2);
  });
});

describe("crypto_address detector — negative cases", () => {
  test.each([
    ["", "empty string"],
    ["hello world", "plain text"],
    ["1234567890", "digits only too short"],
    ["0x123", "ETH too short"],
    ["bc1q", "SegWit too short"],
    ["1A1z", "BTC too short"],
    ["not_an_address", "plain identifier"],
  ])("%s (%s)", (input) => {
    const detections = cryptoAddressDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("crypto_address detector — boundary cases", () => {
  test("minimum BTC P2PKH (26 chars)", () => {
    const addr = "1" + "a".repeat(25);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("maximum BTC P2PKH (35 chars)", () => {
    const addr = "1" + "a".repeat(34);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("minimum ETH (42 chars)", () => {
    const addr = "0x" + "a".repeat(40);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("ETH with mixed case hex", () => {
    const addr = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("minimum SOL (32 chars)", () => {
    const addr = "7" + "x".repeat(31);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("maximum SOL (44 chars)", () => {
    const addr = "7" + "x".repeat(43);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("minimum ADA (55 chars)", () => {
    const addr = "addr1" + "a".repeat(50);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });

  test("BNB with only base58 chars", () => {
    const addr = "bnb1" + "a".repeat(38);
    const detections = cryptoAddressDetector.detect(addr);
    expect(detections).toHaveLength(1);
  });
});

describe("crypto_address detector — adversarial cases", () => {
  test("address embedded in word characters is rejected", () => {
    const addr = "1" + "a".repeat(25);
    const text = `x${addr}x`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("address preceded by letter is rejected", () => {
    const addr = "1" + "a".repeat(25);
    const text = `x${addr}`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("address followed by letter is rejected", () => {
    const addr = "1" + "a".repeat(25);
    const text = `${addr}O`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("address preceded by digit is rejected", () => {
    const addr = "1" + "a".repeat(25);
    const text = `9${addr}`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("address followed by digit is rejected", () => {
    const addr = "1" + "a".repeat(25);
    const text = `${addr}0`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("address with underscore suffix is rejected", () => {
    const addr = "1" + "a".repeat(25);
    const text = `${addr}_`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("emoji before address does not prevent detection", () => {
    const addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    const text = `\uD83D\uDE00 ${addr}`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("trailing period is preserved (not part of match)", () => {
    const addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    const text = `${addr}.`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(addr.length);
  });

  test("trailing comma is preserved", () => {
    const addr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    const text = `${addr},`;
    const detections = cryptoAddressDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(addr.length);
  });
});
