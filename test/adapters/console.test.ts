import { describe, expect, test } from "bun:test";
import { type ConsoleLike, wrapConsole } from "../../src/loggers/console";

const CONSOLE_METHODS = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
  "dir",
  "dirxml",
  "group",
  "groupCollapsed",
] as const;

type Method = (typeof CONSOLE_METHODS)[number];

function createMockConsole(): {
  obj: ConsoleLike;
  calls: Record<Method, unknown[][]>;
} {
  const calls = {} as Record<Method, unknown[][]>;
  const obj = {} as ConsoleLike;

  for (const m of CONSOLE_METHODS) {
    calls[m] = [];
    obj[m] = (...args: unknown[]) => {
      calls[m].push(args);
    };
  }

  return { obj, calls };
}

describe("wrapConsole", () => {
  const redactCases: [Method, string][] = [
    ["log", "redacts email in console.log string args"],
    ["warn", "works with custom consoleObj (warn)"],
    ["group", "console.group passes redacted label"],
    ["info", "redacts email in console.info"],
    ["error", "redacts email in console.error"],
    ["debug", "redacts email in console.debug"],
    ["trace", "redacts email in console.trace"],
    ["dir", "redacts email in console.dir"],
    ["dirxml", "redacts email in console.dirxml"],
    ["groupCollapsed", "console.groupCollapsed passes redacted label"],
  ];

  test.each(redactCases)("%s — %s", (method, _label) => {
    const mock = createMockConsole();

    const restore = wrapConsole(
      { rules: { email: { action: "redact" } } },
      mock.obj,
    );

    mock.obj[method]("alice@example.com");
    expect(mock.calls[method][0]![0]).toBe("[EMAIL]");
    restore();
  });

  test("redacts PII in object args", () => {
    const mock = createMockConsole();
    const restore = wrapConsole(
      { rules: { email: { action: "redact" } } },
      mock.obj,
    );
    mock.obj.log("user", { email: "alice@example.com" });
    expect(mock.calls.log[0]![0]).toBe("user");
    const objArg = mock.calls.log[0]![1] as { email: string };
    expect(objArg.email).toBe("[EMAIL]");
    restore();
  });

  test("redacts sensitive field names", () => {
    const mock = createMockConsole();
    const restore = wrapConsole(
      { rules: { email: { action: "redact" } } },
      mock.obj,
    );
    mock.obj.log({ authorization: "Bearer abc123" });
    const objArg = mock.calls.log[0]![0] as { authorization: string };
    expect(objArg.authorization).toBe("[REDACTED]");
    restore();
  });

  test("restore() reverts all methods", () => {
    const mock = createMockConsole();
    const restore = wrapConsole(
      { rules: { email: { action: "redact" } } },
      mock.obj,
    );
    mock.obj.log("alice@example.com");
    expect(mock.calls.log[0]![0]).toBe("[EMAIL]");
    restore();
    mock.obj.log("alice@example.com");
    expect(mock.calls.log[1]![0]).toBe("alice@example.com");
  });

  test("detectOnly mode leaves args unmodified", () => {
    const mock = createMockConsole();
    const restore = wrapConsole(
      { rules: { email: { action: "redact" } }, detectOnly: true },
      mock.obj,
    );
    mock.obj.log("alice@example.com");
    expect(mock.calls.log[0]![0]).toBe("alice@example.com");
    restore();
  });

  test("does not mutate original argument objects", () => {
    const mock = createMockConsole();
    const restore = wrapConsole(
      { rules: { email: { action: "redact" } } },
      mock.obj,
    );
    const original = { email: "alice@example.com" };
    mock.obj.log(original);
    expect(original.email).toBe("alice@example.com");
    restore();
  });

  test("multiple wrapConsole calls stack correctly", () => {
    const mock = createMockConsole();
    const restoreOuter = wrapConsole(
      { rules: { email: { action: "redact" } } },
      mock.obj,
    );
    const restoreInner = wrapConsole(
      { rules: { phone: { action: "redact" } } },
      mock.obj,
    );
    mock.obj.log("alice@example.com +1-555-123-4567");
    expect(mock.calls.log[0]![0]).toBe("[EMAIL] [PHONE]");
    restoreInner();
    mock.obj.log("alice@example.com +1-555-123-4567");
    expect(mock.calls.log[1]![0]).toBe("[EMAIL] +1-555-123-4567");
    restoreOuter();
    mock.obj.log("alice@example.com +1-555-123-4567");
    expect(mock.calls.log[2]![0]).toBe("alice@example.com +1-555-123-4567");
  });
});
