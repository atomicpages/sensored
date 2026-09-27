import { describe, expect, test } from "bun:test";
import { emailDetector } from "../src/detectors/contact/email";
import { ghCardDetector } from "../src/detectors/national-id/gh-card";
import { makeRedactor } from "./helpers/redactor";

const redactor = makeRedactor([
  { detector: ghCardDetector, setting: { action: "redact" } },
]);

describe("Ghana Card complete-string processing", () => {
  test.each([
    ["Ghana Card: GHA-123456789-1", "Ghana Card: [GH_CARD]"],
    ["Ghana: GHA-123456789-1", "Ghana: [GH_CARD]"],
    ["Ghanaian: GHA-123456789-1", "Ghanaian: [GH_CARD]"],
    ["National ID: GHA-123456789-1", "National ID: [GH_CARD]"],
    ["Identity: GHA-123456789-1", "Identity: [GH_CARD]"],
    ["Ghana Card:GHA-123456789-1", "Ghana Card:[GH_CARD]"],
    ["Ghana Card# GHA-123456789-1", "Ghana Card# [GH_CARD]"],
    ["Ghana Card#GHA-123456789-1", "Ghana Card#[GH_CARD]"],
    ["GHA-123456789-1 (Ghana Card)", "[GH_CARD] (Ghana Card)"],
    ["GHA-123456789-1 Ghana Card", "[GH_CARD] Ghana Card"],
    ["GHA-123456789-1 (Ghana)", "[GH_CARD] (Ghana)"],
    ["GHA-123456789-1 (Identity)", "[GH_CARD] (Identity)"],
    ["ghana card: GHA-123456789-1", "ghana card: [GH_CARD]"],
    ["GHANA: GHA-123456789-1", "GHANA: [GH_CARD]"],
    ["Ghana Card:        GHA-123456789-1", "Ghana Card:        [GH_CARD]"],
    ["Ghana Card:\tGHA-123456789-1", "Ghana Card:\t[GH_CARD]"],
    ["Ghana Card: \t GHA-123456789-1", "Ghana Card: \t [GH_CARD]"],
    ["GHA-123456789-1\t(Ghana Card)", "[GH_CARD]\t(Ghana Card)"],
    ["GHA-123456789-1        (Ghana Card)", "[GH_CARD]        (Ghana Card)"],
    [
      "Ghana Card: GHA-123456789-1 and Ghana Card: GHA-987654321-0",
      "Ghana Card: [GH_CARD] and Ghana Card: [GH_CARD]",
    ],
    ["Ghana Card: GHA-123456789-1.", "Ghana Card: [GH_CARD]."],
    ["(Ghana Card: GHA-123456789-1)", "(Ghana Card: [GH_CARD])"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });

  test.each([
    ["Reference: GHA-123456789-1", "non-approved label"],
    ["GHA-123456789-1", "no label"],
    ["myGhana Card: GHA-123456789-1", "label not whole — my prefix"],
    ["Ghana Cardx: GHA-123456789-1", "label not whole — x suffix"],
    ["Ghana Card:\nGHA-123456789-1", "newline between label and candidate"],
    ["Ghana Card:         GHA-123456789-1", "9 spaces exceeds 0-8"],
    [
      "GHA-123456789-1(Ghana Card)",
      "0 spaces before paren — following requires 1-8",
    ],
    ["GHA-123456789-1 (Ghana Card", "missing closing paren"],
    [
      "GHA-123456789-1x (Ghana Card)",
      "letter after candidate before following label",
    ],
    ["Ghana Card: GHA-12345678-1", "only 8 digits"],
    ["Ghana Card: GHA-1234567890-1", "10 digits"],
    ["Ghana Card: GHA-123456789", "no trailing -digit"],
    ["Ghana Card: gha-123456789-1", "lowercase prefix"],
    ["Ghana Card: GHA-123456789-1_", "underscore after candidate"],
    ["_Ghana Card: GHA-123456789-1", "underscore before label"],
    ["Ghana Card: GHA-123456789-1\u0301", "combining mark after candidate"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });

  test("inspection uses original UTF-16 spans and values", () => {
    const result = redactor.inspect("Ghana Card: GHA-123456789-1");
    expect(result.text).toBe("Ghana Card: [GH_CARD]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "GHA-123456789-1",
      ruleId: "gh_card",
      entityType: "gh_card",
      reasons: ["gh_card.format", "gh_card.context"],
    });
    expect(result.groups[0]?.start).toBe(12);
    expect(result.groups[0]?.end).toBe(27);
  });

  test("inspection for following context", () => {
    const result = redactor.inspect("GHA-123456789-1 (Ghana Card)");
    expect(result.text).toBe("[GH_CARD] (Ghana Card)");
    expect(result.groups[0]?.matches[0]?.value).toBe("GHA-123456789-1");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(15);
  });

  test("mask preserves last 4 graphemes", () => {
    const masker = makeRedactor([
      {
        detector: ghCardDetector,
        setting: { action: "mask", preserve: { last: 4 } },
      },
    ]);
    expect(masker.redact("Ghana Card: GHA-123456789-1")).toBe(
      "Ghana Card: ***********89-1",
    );
  });

  test("remove deletes the candidate", () => {
    const remover = makeRedactor([
      { detector: ghCardDetector, setting: { action: "remove" } },
    ]);
    expect(remover.redact("Ghana Card: GHA-123456789-1")).toBe("Ghana Card: ");
    expect(remover.redact("GHA-123456789-1 (Ghana Card)")).toBe(
      " (Ghana Card)",
    );
  });

  test("coexists with email detector", () => {
    const both = makeRedactor([
      { detector: emailDetector, setting: { action: "redact" } },
      { detector: ghCardDetector, setting: { action: "redact" } },
    ]);
    expect(
      both.redact("Email: alice@example.com Ghana Card: GHA-123456789-1"),
    ).toBe("Email: [EMAIL] Ghana Card: [GH_CARD]");
  });

  test("policy is a frozen snapshot", () => {
    const setting = { action: "redact" as const };
    const instance = makeRedactor([{ detector: ghCardDetector, setting }]);
    expect(Object.isFrozen(instance.policy.gh_card)).toBe(true);
    expect(instance.policy.gh_card).not.toBe(setting);
  });
});
