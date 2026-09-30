import { describe, expect, test } from "bun:test";
import { configure } from "../../src/loggers/log4js";

describe("log4js adapter", () => {
  function createAppender(config: Parameters<typeof configure>[0]): {
    wrapped: { events: { data: unknown[] }[] };
    appender: (loggingEvent: { data: unknown[] }) => void;
  } {
    const wrapped = { events: [] as { data: unknown[] }[] };
    const wrappedAppender = (event: { data: unknown[] }) => {
      wrapped.events.push(event);
    };
    const findAppender = (_name: string) => wrappedAppender;
    const appender = configure(config, undefined, findAppender);
    return { wrapped, appender };
  }

  test("redacts email addresses in string args", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: { rules: { email: { action: "redact" } } },
    });
    appender({ data: ["Contact alice@example.com"] });
    expect(wrapped.events[0]!.data).toEqual(["Contact [EMAIL]"]);
  });

  test("redacts PII in object args", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: { rules: { email: { action: "redact" } } },
    });
    appender({ data: [{ user: "alice@example.com" }] });
    expect(wrapped.events[0]!.data).toEqual([{ user: "[EMAIL]" }]);
  });

  test("redacts PII in nested objects within data args", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: { rules: { email: { action: "redact" } } },
    });
    appender({ data: [{ user: { email: "alice@example.com" } }] });
    expect(wrapped.events[0]!.data).toEqual([{ user: { email: "[EMAIL]" } }]);
  });

  test("redacts PII in array values within data args", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: { rules: { email: { action: "redact" } } },
    });
    appender({ data: [{ emails: ["alice@example.com", "bob@test.org"] }] });
    expect(wrapped.events[0]!.data).toEqual([
      { emails: ["[EMAIL]", "[EMAIL]"] },
    ]);
  });

  test("redacts sensitive field names to [REDACTED]", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: { rules: { email: { action: "redact" } } },
    });
    appender({ data: [{ authorization: "Bearer abc123" }] });
    expect(wrapped.events[0]!.data).toEqual([{ authorization: "[REDACTED]" }]);
  });

  test("does not mutate the original loggingEvent", () => {
    const { appender } = createAppender({
      appender: "stdout",
      redact: { rules: { email: { action: "redact" } } },
    });
    const original = { data: ["alice@example.com"], level: "info" };
    appender(original);
    expect(original.data).toEqual(["alice@example.com"]);
    expect(original.level).toBe("info");
  });

  test("detectOnly mode leaves log events unmodified", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: {
        rules: { email: { action: "redact" } },
        detectOnly: true,
      },
    });
    appender({ data: ["alice@example.com"] });
    expect(wrapped.events[0]!.data).toEqual(["alice@example.com"]);
  });

  test("redacts multiple PII types in one event", () => {
    const { wrapped, appender } = createAppender({
      appender: "stdout",
      redact: {
        rules: {
          email: { action: "redact" },
          phone: { action: "redact" },
        },
      },
    });
    appender({ data: ["Contact alice@example.com or +1-555-123-4567"] });
    expect(wrapped.events[0]!.data).toEqual(["Contact [EMAIL] or [PHONE]"]);
  });

  test("delegates the redacted event to the wrapped appender", () => {
    const received: { data: unknown[] }[] = [];
    const findAppender = (_name: string) => (event: { data: unknown[] }) => {
      received.push(event);
    };
    const appender = configure(
      {
        appender: "stdout",
        redact: { rules: { email: { action: "redact" } } },
      },
      undefined,
      findAppender,
    );
    appender({ data: ["alice@example.com"] });
    expect(received).toHaveLength(1);
    expect(received[0]!.data).toEqual(["[EMAIL]"]);
  });
});
