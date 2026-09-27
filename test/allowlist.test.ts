import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

describe("allowlist — complete-string processing", () => {
  test("allowlisted email is not redacted", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    expect(redactor.redact("Contact alice@example.com")).toBe(
      "Contact alice@example.com",
    );
  });

  test("non-allowlisted email is still redacted", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    expect(redactor.redact("Contact bob@example.com")).toBe("Contact [EMAIL]");
  });

  test("mixed allowlisted and non-allowlisted emails", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    expect(redactor.redact("alice@example.com and bob@example.com")).toBe(
      "alice@example.com and [EMAIL]",
    );
  });

  test("allowlist works across multiple detectors", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
      },
      allowlist: ["alice@example.com", "4242424242424242"],
    });

    expect(redactor.redact("alice@example.com card: 4242424242424242")).toBe(
      "alice@example.com card: 4242424242424242",
    );
  });

  test("allowlist is case-sensitive", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    expect(redactor.redact("Alice@Example.Com")).toBe("[EMAIL]");
  });

  test("empty allowlist is a no-op", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: [],
    });

    expect(redactor.redact("alice@example.com")).toBe("[EMAIL]");
  });

  test("allowlist without config is a no-op", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
    });

    expect(redactor.redact("alice@example.com")).toBe("[EMAIL]");
  });

  test("allowlisted value still works with inspect", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    const result = redactor.inspect("Contact alice@example.com");

    expect(result.text).toBe("Contact alice@example.com");
    expect(result.groups).toHaveLength(0);
  });

  test("allowlisted payment card is not redacted", () => {
    const redactor = createRedactor({
      rules: { payment_card: { action: "redact" } },
      allowlist: ["4242424242424242"],
    });

    expect(redactor.redact("Card: 4242424242424242")).toBe(
      "Card: 4242424242424242",
    );
  });

  test("allowlisted VIN is not redacted", () => {
    const redactor = createRedactor({
      rules: { vin: { action: "redact" } },
      allowlist: ["1HGCM82633A123456"],
    });

    expect(redactor.redact("VIN: 1HGCM82633A123456")).toBe(
      "VIN: 1HGCM82633A123456",
    );
  });
});

describe("allowlist — streaming", () => {
  test("allowlisted value is not redacted in streaming mode", async () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    async function* chunks() {
      yield "Contact ";
      yield "alice@example.com";
      yield " today";
    }

    const events: string[] = [];

    for await (const event of redactor.stream(chunks())) {
      if (event.type === "text") {
        events.push(event.text);
      } else if (event.type === "detection") {
        events.push(event.group.replacement);
      }
    }

    expect(events.join("")).toBe("Contact alice@example.com today");
  });

  test("non-allowlisted value is still redacted in streaming mode", async () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
    });

    async function* chunks() {
      yield "Contact ";
      yield "bob@example.com";
      yield " today";
    }

    const events: string[] = [];

    for await (const event of redactor.stream(chunks())) {
      if (event.type === "text") {
        events.push(event.text);
      } else if (event.type === "detection") {
        events.push(event.group.replacement);
      }
    }

    expect(events.join("")).toBe("Contact [EMAIL] today");
  });
});

describe("allowlist — validation", () => {
  test("non-array allowlist throws", () => {
    expect(() =>
      createRedactor({
        rules: { email: { action: "redact" } },
        allowlist: "alice@example.com" as never,
      }),
    ).toThrow(SensoredError);
  });

  test("non-string item in allowlist throws", () => {
    expect(() =>
      createRedactor({
        rules: { email: { action: "redact" } },
        allowlist: [123 as never],
      }),
    ).toThrow(SensoredError);
  });

  test("empty string in allowlist throws", () => {
    expect(() =>
      createRedactor({
        rules: { email: { action: "redact" } },
        allowlist: [""],
      }),
    ).toThrow(SensoredError);
  });
});

describe("allowlist — restore", () => {
  test("allowlisted value is not in restoration map", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      allowlist: ["alice@example.com"],
      restore: true,
    });

    const result = redactor.redact("alice@example.com and bob@example.com");

    expect(result.text).toBe("alice@example.com and [EMAIL_1]");
    expect(result.map).toBeDefined();
    expect(Object.values(result.map!)).not.toContain("alice@example.com");
  });
});
