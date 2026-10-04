import { describe, expect, it } from "bun:test";
import { createSession } from "../src/session";
import type { RedactorConfig } from "../src/types";

const baseConfig: RedactorConfig = {
  rules: {
    email: { action: "redact" },
    phone: { action: "redact" },
    us_ssn: { action: "redact" },
    payment_card: { action: "redact" },
  },
};

describe("createSession", () => {
  it("redacts a single value", () => {
    const session = createSession(baseConfig);
    const result = session.redact("contact john@example.com");

    expect(result).toBe("contact [EMAIL_1]");
    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
  });

  it("restores placeholders back to originals", () => {
    const session = createSession(baseConfig);
    const original = "email john@example.com or call 415-555-1234";
    const redacted = session.redact(original);

    expect(session.restore(redacted)).toBe(original);
  });

  it("deduplicates same PII value across calls", () => {
    const session = createSession(baseConfig);

    const first = session.redact("email john@example.com please");
    const second = session.redact("also email john@example.com again");

    expect(first).toBe("email [EMAIL_1] please");
    expect(second).toBe("also email [EMAIL_1] again");
    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
  });

  it("assigns different placeholders for different values", () => {
    const session = createSession(baseConfig);

    session.redact("email john@example.com");
    session.redact("email jane@test.org");

    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
    expect(session.map["[EMAIL_2]"]).toBe("jane@test.org");
  });

  it("redactMessages redacts message arrays", () => {
    const session = createSession(baseConfig);
    const messages = [
      { role: "user", content: "email john@example.com" },
      { role: "assistant", content: "sure, I will email [EMAIL_1]" },
    ];

    const redacted = session.redactMessages(messages);

    expect(redacted[0]?.content).toBe("email [EMAIL_1]");
    expect(redacted[1]?.content).toBe("sure, I will email [EMAIL_1]");
  });

  it("stream() returns a StreamRestorer bound to current map", () => {
    const session = createSession(baseConfig);
    session.redact("email john@example.com");

    const restorer = session.stream();
    const out = restorer.push("contact [EMAIL_1] now");
    const flushed = restorer.flush();

    expect(out + flushed).toBe("contact john@example.com now");
  });

  it("reset() clears the map and reverse lookup", () => {
    const session = createSession(baseConfig);
    session.redact("email john@example.com");
    expect(Object.keys(session.map).length).toBe(1);

    session.reset();

    expect(Object.keys(session.map).length).toBe(0);

    const result = session.redact("email john@example.com");
    expect(result).toBe("email [EMAIL_1]");
  });

  it("throws INVALID_CONFIG when detectOnly is true", () => {
    expect(() => createSession({ ...baseConfig, detectOnly: true })).toThrow();
  });

  it("does not throw when restore is false (forced silently)", () => {
    expect(() =>
      createSession({ ...baseConfig, restore: false }),
    ).not.toThrow();
  });

  it("branded with Symbol.for('sensored.session')", () => {
    const session = createSession(baseConfig);
    const brand = Symbol.for("sensored.session");
    // Cast required: symbol-keyed property access is not in TS's type narrowing
    expect((session as unknown as Record<symbol, unknown>)[brand]).toBe(true);
  });
});

describe("createSession hydration", () => {
  it("hydrates from existing map and continues numbering", () => {
    const existingMap = {
      "[EMAIL_1]": "john@example.com",
      "[PHONE_1]": "415-555-1234",
    };

    const session = createSession(baseConfig, existingMap);

    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
    expect(session.map["[PHONE_1]"]).toBe("415-555-1234");

    const result = session.redact("email jane@test.org");
    expect(result).toBe("email [EMAIL_2]");
    expect(session.map["[EMAIL_2]"]).toBe("jane@test.org");
  });

  it("reuses placeholders from hydrated map for same values", () => {
    const existingMap = {
      "[EMAIL_1]": "john@example.com",
    };

    const session = createSession(baseConfig, existingMap);
    const result = session.redact("email john@example.com again");

    expect(result).toBe("email [EMAIL_1] again");
  });

  it("handles empty existingMap", () => {
    const session = createSession(baseConfig, {});
    const result = session.redact("email john@example.com");

    expect(result).toBe("email [EMAIL_1]");
  });

  it("skips malformed keys in existingMap silently", () => {
    const existingMap = {
      "[EMAIL_1]": "john@example.com",
      malformed_key: "should-be-ignored",
      "[BAD]": "also-ignored",
    };

    const session = createSession(baseConfig, existingMap);

    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
    expect(session.map.malformed_key).toBeUndefined();

    const result = session.redact("email jane@test.org");
    expect(result).toBe("email [EMAIL_2]");
  });

  it("reset() preserves hydration map from session creation", () => {
    const existingMap = {
      "[EMAIL_1]": "john@example.com",
      "[PHONE_1]": "415-555-1234",
    };

    const session = createSession(baseConfig, existingMap);

    session.redact("email jane@test.org");
    expect(session.map["[EMAIL_2]"]).toBe("jane@test.org");

    session.reset();

    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
    expect(session.map["[PHONE_1]"]).toBe("415-555-1234");
    expect(session.map["[EMAIL_2]"]).toBeUndefined();

    const result = session.redact("email jane@test.org");
    expect(result).toBe("email [EMAIL_2]");
  });
});

describe("createSession streaming", () => {
  it("restores placeholder split across chunk boundaries", () => {
    const session = createSession(baseConfig);
    session.redact("email john@example.com");

    const restorer = session.stream();

    const out1 = restorer.push("contact [EMA");
    const out2 = restorer.push("IL_1] now");
    const flushed = restorer.flush();

    expect(out1).toBe("contact ");
    expect(out2 + flushed).toBe("john@example.com now");
  });

  it("restores multiple placeholders across chunks", () => {
    const session = createSession(baseConfig);
    session.redact("email john@example.com or call 415-555-1234");

    const restorer = session.stream();

    const out1 = restorer.push("contact [EMAIL_1] or [PHO");
    const out2 = restorer.push("NE_1] now");
    const flushed = restorer.flush();

    expect(out1).toBe("contact john@example.com or ");
    expect(out2 + flushed).toBe("415-555-1234 now");
  });
});

describe("createSession redactMessages with tool calls", () => {
  it("redacts nested tool call arguments", () => {
    const session = createSession(baseConfig);
    const messages = [
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "send_email",
              arguments: '{"to": "415-555-1234"}',
            },
          },
        ],
      },
    ];

    const redacted = session.redactMessages(messages);

    expect(redacted[0]?.tool_calls?.[0]?.function.arguments).toBe(
      '{"to": "[PHONE_1]"}',
    );
  });
});

describe("createSession multi-turn consistency", () => {
  it("preserves placeholder consistency across 3+ turns", () => {
    const session = createSession(baseConfig);

    const turn1 = session.redact("email john@example.com");
    const turn2 = session.redact("reply to john@example.com please");
    const turn3 = session.redact("also CC john@example.com and jane@test.org");

    expect(turn1).toBe("email [EMAIL_1]");
    expect(turn2).toBe("reply to [EMAIL_1] please");
    expect(turn3).toBe("also CC [EMAIL_1] and [EMAIL_2]");

    expect(session.map["[EMAIL_1]"]).toBe("john@example.com");
    expect(session.map["[EMAIL_2]"]).toBe("jane@test.org");
  });
});
