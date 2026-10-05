import { describe, expect, test } from "bun:test";
import { cryptoTxHashDetector } from "../src/detectors/crypto/crypto-tx-hash";

const VALID_HASH =
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

describe("crypto_tx_hash detector — positive cases", () => {
  test.each([
    [`Transaction: ${VALID_HASH}`, "Transaction label"],
    [`Tx Hash: ${VALID_HASH}`, "Tx Hash label"],
    [`Transaction ID: ${VALID_HASH}`, "Transaction ID label"],
    [`Transaction Hash: ${VALID_HASH}`, "Transaction Hash label"],
    [`Blockchain Transaction: ${VALID_HASH}`, "Blockchain Transaction label"],
    [`TXID: ${VALID_HASH}`, "TXID label"],
    [`transaction: ${VALID_HASH}`, "lowercase transaction"],
    [`tx hash: ${VALID_HASH}`, "lowercase tx hash"],
    [`Transaction:${VALID_HASH}`, "no space after colon"],
    [`Transaction#${VALID_HASH}`, "hash separator"],
    [`Transaction# ${VALID_HASH}`, "hash separator with space"],
    [`Transaction:    ${VALID_HASH}`, "multiple spaces after label"],
    [`Transaction:\t${VALID_HASH}`, "tab after label"],
    [`${VALID_HASH} (Transaction)`, "following paren context"],
    [`${VALID_HASH} (Tx Hash)`, "following paren Tx Hash"],
    [`${VALID_HASH} (Transaction ID)`, "following paren Transaction ID"],
    [`${VALID_HASH} (TXID)`, "following paren TXID"],
    [`${VALID_HASH} Transaction`, "following non-paren context"],
    [`${VALID_HASH}\t(TXID)`, "tab before paren"],
    [`Transaction: ${VALID_HASH}.`, "trailing period"],
  ])("%s (%s)", (input) => {
    const detections = cryptoTxHashDetector.detect(input);
    expect(detections).toHaveLength(1);
    expect(detections[0]).toMatchObject({
      ruleId: "crypto_tx_hash",
      entityType: "crypto_tx_hash",
      reasons: ["crypto_tx_hash.format", "crypto_tx_hash.context"],
    });
  });
});

describe("crypto_tx_hash detector — negative cases", () => {
  test.each([
    [VALID_HASH, "no context"],
    [`Reference: ${VALID_HASH}`, "wrong label"],
    [`Hash: ${VALID_HASH}`, "wrong label 2"],
    [`myTransaction: ${VALID_HASH}`, "label not whole — my prefix"],
    [`Transactionx: ${VALID_HASH}`, "label not whole — x suffix"],
    [`Transaction:\n${VALID_HASH}`, "newline between label and hash"],
    [`${VALID_HASH}(Transaction)`, "0 spaces before paren"],
    [`${VALID_HASH}         (Transaction)`, "9 spaces exceeds 1-8"],
    [`${VALID_HASH}x (Transaction)`, "letter after hash before paren"],
    [`Transaction: ${VALID_HASH}x`, "letter after hash"],
    [`Transaction: ${VALID_HASH}_`, "underscore after hash"],
    [`Transaction: ${"g".repeat(64)}`, "non-hex characters"],
    [`Transaction: ${"a".repeat(63)}`, "63 chars too short"],
    [`Transaction: ${"a".repeat(65)}`, "65 chars too long"],
    [`${"A".repeat(64)}`, "uppercase hex without context"],
  ])("%s (%s)", (input) => {
    const detections = cryptoTxHashDetector.detect(input);
    expect(detections).toHaveLength(0);
  });
});

describe("crypto_tx_hash detector — boundary cases", () => {
  test("exactly 64 hex chars with context", () => {
    const hash = "a".repeat(64);
    const detections = cryptoTxHashDetector.detect(`Transaction: ${hash}`);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.start).toBe(13);
    expect(detections[0]?.end).toBe(77);
  });

  test("mixed case hex with context", () => {
    const hash =
      "aBcDeF0123456789aBcDeF0123456789aBcDeF0123456789aBcDeF0123456789";
    const detections = cryptoTxHashDetector.detect(`Transaction: ${hash}`);
    expect(detections).toHaveLength(1);
  });

  test("all digits hex with context", () => {
    const hash = "0".repeat(64);
    const detections = cryptoTxHashDetector.detect(`Transaction: ${hash}`);
    expect(detections).toHaveLength(1);
  });

  test("all uppercase hex with context", () => {
    const hash = "A".repeat(64);
    const detections = cryptoTxHashDetector.detect(`Transaction: ${hash}`);
    expect(detections).toHaveLength(1);
  });

  test("context at maximum left distance (40 chars)", () => {
    const prefix = `${"x".repeat(26)} Transaction: `;
    const hash = "a".repeat(64);
    const text = `${prefix}${hash}`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("context beyond maximum left distance", () => {
    const prefix = `Transaction: ${" ".repeat(28)}`;
    const hash = "a".repeat(64);
    const text = `${prefix}${hash}`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("following context at maximum right distance (20 chars)", () => {
    const hash = "a".repeat(64);
    const suffix = " (Transaction)";
    const padding = " ".repeat(20 - suffix.length);
    const text = `${hash}${padding}${suffix}`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(1);
  });
});

describe("crypto_tx_hash detector — adversarial cases", () => {
  test("hash embedded in word characters is rejected", () => {
    const text = `Transaction: x${VALID_HASH}x`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("hash preceded by digit is rejected", () => {
    const text = `Transaction: 9${VALID_HASH}`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("hash followed by digit is rejected", () => {
    const text = `Transaction: ${VALID_HASH}9`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("hash with underscore suffix is rejected", () => {
    const text = `Transaction: ${VALID_HASH}_`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("emoji before label does not prevent detection", () => {
    const text = `\uD83D\uDE00 Transaction: ${VALID_HASH}`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(1);
  });

  test("trailing period after hash is preserved", () => {
    const text = `Transaction: ${VALID_HASH}.`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.end).toBe(13 + 64);
  });

  test("multiple hashes with context", () => {
    const text = `Transaction: ${VALID_HASH} and Transaction: ${VALID_HASH}`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(2);
  });

  test("hash without context in long text is not detected", () => {
    const text = `Some random text ${VALID_HASH} more text here`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });

  test("combining mark after hash is rejected", () => {
    const text = `Transaction: ${VALID_HASH}\u0301`;
    const detections = cryptoTxHashDetector.detect(text);
    expect(detections).toHaveLength(0);
  });
});
