import { describe, expect, test } from "bun:test";
import { StreamRestorer } from "../src/stream-restore";
import type { RestorationMap } from "../src/types";

const map: RestorationMap = {
  "[EMAIL_1]": "alice@example.com",
  "[PHONE_1]": "555-1234",
  "[EMAIL_2]": "bob@example.com",
  "[PHONE_2]": "555-5678",
};

describe("StreamRestorer", () => {
  test("complete placeholder in one chunk", () => {
    const r = new StreamRestorer(map);
    expect(r.push("contact [EMAIL_1]")).toBe("contact alice@example.com");
  });

  test("placeholder split across 2 chunks", () => {
    const r = new StreamRestorer(map);
    expect(r.push("contact [EMA")).toBe("contact ");
    expect(r.push("IL_1]")).toBe("alice@example.com");
  });

  test("placeholder split across 3+ chunks", () => {
    const r = new StreamRestorer(map);
    expect(r.push("contact [E")).toBe("contact ");
    expect(r.push("MA")).toBe("");
    expect(r.push("IL_")).toBe("");
    expect(r.push("1]")).toBe("alice@example.com");
  });

  test("multiple placeholders in one chunk", () => {
    const r = new StreamRestorer(map);
    expect(r.push("[EMAIL_1] and [PHONE_1]")).toBe(
      "alice@example.com and 555-1234",
    );
  });

  test("no placeholders passes through", () => {
    const r = new StreamRestorer(map);
    expect(r.push("hello world")).toBe("hello world");
  });

  test("held-back text that is not a placeholder is flushed unmodified", () => {
    const r = new StreamRestorer(map);
    expect(r.push("text [EMA")).toBe("text ");
    expect(r.flush()).toBe("[EMA");
  });

  test("empty map passes through", () => {
    const r = new StreamRestorer({});
    expect(r.push("contact [EMAIL_1]")).toBe("contact [EMAIL_1]");
  });

  test("adjacent placeholders split at boundary", () => {
    const r = new StreamRestorer(map);
    expect(r.push("...[EMAIL_1]")).toBe("...alice@example.com");
    expect(r.push("[PHONE_1]...")).toBe("555-1234...");
  });

  test("flush after all consumed returns empty string", () => {
    const r = new StreamRestorer(map);
    r.push("contact [EMAIL_1]");
    expect(r.flush()).toBe("");
  });

  test("flush with remaining held partial text returns unmodified", () => {
    const r = new StreamRestorer(map);
    r.push("contact [EMAIL_1");
    expect(r.flush()).toBe("[EMAIL_1");
  });

  test("flush with complete held placeholder returns restored", () => {
    const r = new StreamRestorer(map);
    r.push("contact ");
    expect(r.push("[EMAIL_1]")).toBe("alice@example.com");
    expect(r.flush()).toBe("");
  });

  test("text with [REDACTED] passes through", () => {
    const r = new StreamRestorer(map);
    expect(r.push("this is [REDACTED] text")).toBe("this is [REDACTED] text");
  });

  test("text with lone [ passes through", () => {
    const r = new StreamRestorer(map);
    expect(r.push("array[0] = 1")).toBe("array[0] = 1");
  });

  test("empty string push returns empty string", () => {
    const r = new StreamRestorer(map);
    expect(r.push("")).toBe("");
  });

  test("multiple push then flush cycle", () => {
    const r = new StreamRestorer(map);
    expect(r.push("[EMAIL_1] ")).toBe("alice@example.com ");
    expect(r.push("[PHONE_1] ")).toBe("555-1234 ");
    expect(r.push("[EMAIL_2]")).toBe("bob@example.com");
    expect(r.flush()).toBe("");
  });

  test("partial-looking text that is not a placeholder", () => {
    const r = new StreamRestorer(map);
    expect(r.push("text [SOME_TEXT")).toBe("text [SOME_TEXT");
    expect(r.push(" more text")).toBe(" more text");
  });

  test("placeholder at start of chunk", () => {
    const r = new StreamRestorer(map);
    expect(r.push("[EMAIL_1] rest")).toBe("alice@example.com rest");
  });

  test("placeholder at end of chunk then flush", () => {
    const r = new StreamRestorer(map);
    expect(r.push("start [EMAIL_1]")).toBe("start alice@example.com");
    expect(r.flush()).toBe("");
  });

  test("multiple partials accumulated correctly", () => {
    const r = new StreamRestorer(map);
    expect(r.push("a [EMA")).toBe("a ");
    expect(r.push("IL_1] b [PHO")).toBe("alice@example.com b ");
    expect(r.push("NE_1] c")).toBe("555-1234 c");
  });

  test("overlapping partial placeholders", () => {
    const r = new StreamRestorer(map);
    expect(r.push("x [EMAIL_1][PHONE")).toBe("x alice@example.com");
    expect(r.push("_1] y")).toBe("555-1234 y");
  });

  test("overlapping partials where second starts before first completes", () => {
    const r = new StreamRestorer(map);
    expect(r.push("[EMA")).toBe("");
    expect(r.push("IL_1][PHO")).toBe("alice@example.com");
    expect(r.push("NE_1]")).toBe("555-1234");
  });
});

describe("StreamRestorer — every split point", () => {
  function restoreSplit(input: string, split: number, m: RestorationMap) {
    const restorer = new StreamRestorer(m);

    return (
      restorer.push(input.slice(0, split)) +
      restorer.push(input.slice(split)) +
      restorer.flush()
    );
  }

  test("a chunk ending in a lone '[' still restores the placeholder", () => {
    const input = "Mail [EMAIL_1] or call [PHONE_2] now";
    const expected = "Mail alice@example.com or call 555-5678 now";

    for (let split = 1; split < input.length; split++) {
      expect(restoreSplit(input, split, map)).toBe(expected);
    }
  });

  test("placeholders longer than any default entity type still restore", () => {
    const long: RestorationMap = {
      "[A_VERY_LONG_CUSTOM_ENTITY_TYPE_NAME_FOR_TESTING_1]": "secret",
    };

    const input = "x [A_VERY_LONG_CUSTOM_ENTITY_TYPE_NAME_FOR_TESTING_1] y";

    for (let split = 1; split < input.length; split++) {
      expect(restoreSplit(input, split, long)).toBe("x secret y");
    }
  });

  test("text that cannot become a known placeholder is not held back", () => {
    const restorer = new StreamRestorer(map);

    expect(restorer.push("array[0")).toBe("array[0");
    expect(restorer.push("[UNKNOWN_")).toBe("[UNKNOWN_");
  });
});
