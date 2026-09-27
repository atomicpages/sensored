import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

const redactor = createRedactor({
  rules: { digital_identity: { action: "redact" } },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("digital_identity detector — positive cases", () => {
  test.each([
    ["Username: john_doe", "Username: [DIGITAL_IDENTITY]"],
    ["Username: alice123", "Username: [DIGITAL_IDENTITY]"],
    ["User ID: player_one", "User ID: [DIGITAL_IDENTITY]"],
    ["Handle: @alice", "Handle: [DIGITAL_IDENTITY]"],
    ["Handle: @john.doe", "Handle: [DIGITAL_IDENTITY]"],
    ["Screen Name: john.doe", "Screen Name: [DIGITAL_IDENTITY]"],
    ["Gamertag: xX_Slayer_Xx", "Gamertag: [DIGITAL_IDENTITY]"],
    ["Discord ID: 123456789012345678", "Discord ID: [DIGITAL_IDENTITY]"],
    ["Steam ID: STEAM_0:1:123456789", "Steam ID: [DIGITAL_IDENTITY]"],
    ["PSN ID: player1", "PSN ID: [DIGITAL_IDENTITY]"],
    ["Xbox Gamertag: Ninja42", "Xbox Gamertag: [DIGITAL_IDENTITY]"],
    ["username: john_doe", "username: [DIGITAL_IDENTITY]"],
    ["USERNAME: john_doe", "USERNAME: [DIGITAL_IDENTITY]"],
    ["Username: john_doe.", "Username: [DIGITAL_IDENTITY]."],
    ["(Username: john_doe)", "(Username: [DIGITAL_IDENTITY])"],
    [
      "Username: john_doe and Username: alice123",
      "Username: [DIGITAL_IDENTITY] and Username: [DIGITAL_IDENTITY]",
    ],
    [
      "before Username: john_doe after",
      "before Username: [DIGITAL_IDENTITY] after",
    ],
    ["Username:john_doe", "Username:[DIGITAL_IDENTITY]"],
    ["Username# john_doe", "Username# [DIGITAL_IDENTITY]"],
    ["Username#john_doe", "Username#[DIGITAL_IDENTITY]"],
    ["Username: \t john_doe", "Username: \t [DIGITAL_IDENTITY]"],
    ["john_doe (Username)", "[DIGITAL_IDENTITY] (Username)"],
    ["john_doe (Discord ID)", "[DIGITAL_IDENTITY] (Discord ID)"],
    ["123456789012345678 (Discord ID)", "[DIGITAL_IDENTITY] (Discord ID)"],
    ["12345678901234567 (Discord ID)", "[DIGITAL_IDENTITY] (Discord ID)"],
    ["1234567890123456789 (Discord ID)", "[DIGITAL_IDENTITY] (Discord ID)"],
    ["STEAM_0:1:123456789 (Steam ID)", "[DIGITAL_IDENTITY] (Steam ID)"],
    ["xjohn_doe (Username)", "[DIGITAL_IDENTITY] (Username)"],
  ])("%s", (input, expected) => {
    expect(redactor.redact(input)).toBe(expected);
    expect(redactor.inspect(input).text).toBe(expected);
  });
});

describe("digital_identity detector — negative cases", () => {
  test.each([
    ["john went to the store", "no context"],
    ["john_doe", "no context, bare"],
    ["@alice", "no context, @-handle"],
    ["123456789012345678", "no context, Discord ID"],
    ["STEAM_0:1:123456789", "no context, Steam ID"],
    ["Username: the", "blocklisted word"],
    ["Username: and", "blocklisted word"],
    ["Username: for", "blocklisted word"],
    ["Username: admin", "blocklisted word"],
    ["Username: not", "blocklisted word"],
    ["Username: was", "blocklisted word"],
    ["Username: 123", "pure numeric, too short"],
    ["Username: 12345", "pure numeric, too short"],
    ["Reference: john_doe", "wrong context label"],
    ["myUsername: john_doe", "label not whole — my prefix"],
    ["Usernamex: john_doe", "label not whole — x suffix"],
    ["Username:\njohn_doe", "newline between label and value"],
    ["Username:         john_doe", "9 spaces exceeds 0-8"],
    ["john_doe(Username)", "0 spaces before paren — following requires 1-8"],
    ["john_doe Username", "generic username with non-paren following context"],
    ["_Username: john_doe", "underscore before label"],
    ["Username: john_doe\u0301", "combining mark after candidate"],
    ["\ud835\udfd9Username: john_doe", "Unicode number before label"],
    ["Username: john_doe\ud835\udfd9", "Unicode number after candidate"],
    ["Username: caf\u00e9", "accented char not matched by \\w"],
  ])("%s (%s)", (input) => {
    expect(redactor.redact(input)).toBe(input);
    expect(redactor.inspect(input).text).toBe(input);
  });
});

describe("digital_identity detector — boundary cases", () => {
  test("minimum length generic username (3 chars)", () => {
    expect(redactor.redact("Username: abc")).toBe(
      "Username: [DIGITAL_IDENTITY]",
    );
  });

  test("below minimum length generic username (2 chars)", () => {
    expect(redactor.redact("Username: ab")).toBe("Username: ab");
  });

  test("maximum length generic username (32 chars)", () => {
    const value = "a".repeat(32);
    expect(redactor.redact(`Username: ${value}`)).toBe(
      `Username: [DIGITAL_IDENTITY]`,
    );
  });

  test("above maximum length generic username (33 chars)", () => {
    const value = "a".repeat(33);
    expect(redactor.redact(`Username: ${value}`)).toBe(`Username: ${value}`);
  });

  test("minimum @-handle (@ + 1 char)", () => {
    expect(redactor.redact("Handle: @a")).toBe("Handle: [DIGITAL_IDENTITY]");
  });

  test("maximum @-handle (@ + 31 chars = 32 total)", () => {
    const value = "@" + "a".repeat(31);
    expect(redactor.redact(`Handle: ${value}`)).toBe(
      `Handle: [DIGITAL_IDENTITY]`,
    );
  });

  test("above maximum @-handle (@ + 32 chars = 33 total)", () => {
    const value = "@" + "a".repeat(32);
    expect(redactor.redact(`Handle: ${value}`)).toBe(`Handle: ${value}`);
  });

  test("minimum Discord ID (17 digits)", () => {
    const value = "1".repeat(17);
    expect(redactor.redact(`Discord ID: ${value}`)).toBe(
      "Discord ID: [DIGITAL_IDENTITY]",
    );
  });

  test("maximum Discord ID (19 digits)", () => {
    const value = "1".repeat(19);
    expect(redactor.redact(`Discord ID: ${value}`)).toBe(
      "Discord ID: [DIGITAL_IDENTITY]",
    );
  });

  test("below minimum Discord ID (16 digits)", () => {
    const value = "1".repeat(16);
    expect(redactor.redact(`Discord ID: ${value}`)).toBe(
      `Discord ID: ${value}`,
    );
  });

  test("above maximum Discord ID (20 digits) — adjacency prevents partial match", () => {
    const value = "1".repeat(20);
    expect(redactor.redact(`Discord ID: ${value}`)).toBe(
      `Discord ID: ${value}`,
    );
  });

  test("Steam ID with single-digit account", () => {
    expect(redactor.redact("Steam ID: STEAM_0:1:5")).toBe(
      "Steam ID: [DIGITAL_IDENTITY]",
    );
  });

  test("trailing period preserved", () => {
    expect(redactor.redact("Username: john_doe.")).toBe(
      "Username: [DIGITAL_IDENTITY].",
    );
  });

  test("trailing text preserved", () => {
    expect(redactor.redact("Username: john_doe extra")).toBe(
      "Username: [DIGITAL_IDENTITY] extra",
    );
  });

  test("multiple usernames in text", () => {
    expect(redactor.redact("Username: john_doe and Username: alice123")).toBe(
      "Username: [DIGITAL_IDENTITY] and Username: [DIGITAL_IDENTITY]",
    );
  });
});

describe("digital_identity detector — adversarial cases", () => {
  test("very long string is not redacted", () => {
    const value = "a".repeat(100);
    expect(redactor.redact(`Username: ${value}`)).toBe(`Username: ${value}`);
  });

  test("emoji before candidate does not shift alignment", () => {
    expect(redactor.redact("\ud83d\ude00 Username: john_doe")).toBe(
      "\ud83d\ude00 Username: [DIGITAL_IDENTITY]",
    );
  });

  test("Unicode username with accented characters is not matched (\\w is ASCII)", () => {
    expect(redactor.redact("Username: caf\u00e9")).toBe("Username: caf\u00e9");
  });

  test("overlapping candidates — @-handle takes priority", () => {
    expect(redactor.redact("Handle: @alice")).toBe(
      "Handle: [DIGITAL_IDENTITY]",
    );
  });

  test("Steam ID with 21 digits — not redacted (adjacent forbidden)", () => {
    expect(redactor.redact("Steam ID: STEAM_0:1:123456789012345678901")).toBe(
      "Steam ID: STEAM_0:1:123456789012345678901",
    );
  });

  test("Discord ID with leading word character — matched as generic username", () => {
    expect(redactor.redact("Discord ID: x123456789012345678")).toBe(
      "Discord ID: [DIGITAL_IDENTITY]",
    );
  });

  test("Discord ID with trailing word character — not redacted (adjacent forbidden)", () => {
    expect(redactor.redact("Discord ID: 123456789012345678x")).toBe(
      "Discord ID: 123456789012345678x",
    );
  });
});

describe("digital_identity detector — inspection", () => {
  test("inspect returns correct spans, ruleId, entityType, reasons, value", () => {
    const result = redactor.inspect("Username: john_doe");

    expect(result.text).toBe("Username: [DIGITAL_IDENTITY]");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.matches[0]).toMatchObject({
      value: "john_doe",
      ruleId: "digital_identity",
      entityType: "digital_identity",
      reasons: ["digital_identity.format", "digital_identity.context"],
    });
    expect(result.groups[0]?.start).toBe(10);
    expect(result.groups[0]?.end).toBe(18);
  });

  test("inspect for @-handle", () => {
    const result = redactor.inspect("Handle: @alice");

    expect(result.text).toBe("Handle: [DIGITAL_IDENTITY]");
    expect(result.groups[0]?.matches[0]?.value).toBe("@alice");
    expect(result.groups[0]?.start).toBe(8);
    expect(result.groups[0]?.end).toBe(14);
  });

  test("inspect for Discord ID", () => {
    const result = redactor.inspect("Discord ID: 123456789012345678");

    expect(result.text).toBe("Discord ID: [DIGITAL_IDENTITY]");
    expect(result.groups[0]?.matches[0]?.value).toBe("123456789012345678");
    expect(result.groups[0]?.start).toBe(12);
    expect(result.groups[0]?.end).toBe(30);
  });

  test("inspect for Steam ID", () => {
    const result = redactor.inspect("Steam ID: STEAM_0:1:123456789");

    expect(result.text).toBe("Steam ID: [DIGITAL_IDENTITY]");
    expect(result.groups[0]?.matches[0]?.value).toBe("STEAM_0:1:123456789");
    expect(result.groups[0]?.start).toBe(10);
    expect(result.groups[0]?.end).toBe(29);
  });

  test("inspect for following context", () => {
    const result = redactor.inspect("john_doe (Username)");

    expect(result.text).toBe("[DIGITAL_IDENTITY] (Username)");
    expect(result.groups[0]?.matches[0]?.value).toBe("john_doe");
    expect(result.groups[0]?.start).toBe(0);
    expect(result.groups[0]?.end).toBe(8);
  });

  test("inspect for multiple matches", () => {
    const result = redactor.inspect(
      "Username: john_doe and Username: alice123",
    );

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.matches[0]?.value).toBe("john_doe");
    expect(result.groups[1]?.matches[0]?.value).toBe("alice123");
  });
});

describe("digital_identity detector — actions", () => {
  test("mask preserves first 2 graphemes", () => {
    const masker = createRedactor({
      rules: {
        digital_identity: { action: "mask", preserve: { first: 2 } },
      },
    });

    expect(masker.redact("Username: john_doe")).toBe("Username: jo******");
  });

  test("remove deletes the candidate", () => {
    const remover = createRedactor({
      rules: { digital_identity: { action: "remove" } },
    });

    expect(remover.redact("Username: john_doe")).toBe("Username: ");
  });

  test("custom replacement", () => {
    const custom = createRedactor({
      rules: {
        digital_identity: { action: "redact", replacement: "[CUSTOM]" },
      },
    });

    expect(custom.redact("Username: john_doe")).toBe("Username: [CUSTOM]");
  });
});

describe("digital_identity detector — coexistence", () => {
  test("coexists with email detector", () => {
    const both = createRedactor({
      rules: {
        email: { action: "redact" },
        digital_identity: { action: "redact" },
      },
    });

    expect(both.redact("Email: alice@example.com Username: john_doe")).toBe(
      "Email: [EMAIL] Username: [DIGITAL_IDENTITY]",
    );
  });

  test("coexists with SSN detector", () => {
    const both = createRedactor({
      rules: {
        us_ssn: { action: "redact" },
        digital_identity: { action: "redact" },
      },
    });

    expect(both.redact("SSN: 123-45-6789 Username: john_doe")).toBe(
      "SSN: [US_SSN] Username: [DIGITAL_IDENTITY]",
    );
  });

  test("coexists with passport detector", () => {
    const both = createRedactor({
      rules: {
        passport: { action: "redact" },
        digital_identity: { action: "redact" },
      },
    });

    expect(both.redact("Passport: 123456789 Username: john_doe")).toBe(
      "Passport: [PASSPORT] Username: [DIGITAL_IDENTITY]",
    );
  });
});

describe("digital_identity detector — policy and errors", () => {
  test("policy is a frozen snapshot", () => {
    const config = {
      rules: { digital_identity: { action: "redact" as const } },
    };
    const instance = createRedactor(config);

    expect(Object.isFrozen(instance.policy.digital_identity)).toBe(true);
    expect(instance.policy.digital_identity).not.toBe(
      config.rules.digital_identity,
    );
  });

  test("digital_identity off with no other rules throws", () => {
    expect(() =>
      createRedactor({
        rules: { digital_identity: "off" },
      }),
    ).toThrow(SensoredError);
  });

  test("unknown digital_identity rule throws", () => {
    expect(() =>
      createRedactor({
        rules: { digital_identity: { action: "invalid" as never } },
      }),
    ).toThrow(SensoredError);
  });

  test("invalid input type throws SensoredError", () => {
    expect(() => redactor.redact(123 as never)).toThrow(SensoredError);
    expect(() => redactor.redact(null as never)).toThrow(SensoredError);
    expect(() => redactor.redact(undefined as never)).toThrow(SensoredError);
  });
});
