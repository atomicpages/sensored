import { expect, test } from "bun:test";
import {
  createRedactor,
  type DetectorDefinition,
  type RuleSetting,
  SensoredError,
} from "../src";

const detector = (
  id: string,
  pattern: RegExp,
  replacement = `<${id}>`,
): DetectorDefinition => ({ id, entityType: id, pattern, replacement });
function run(
  definitions: DetectorDefinition[],
  rules: Record<string, RuleSetting>,
  text = "abcdef",
) {
  return createRedactor({ detectors: definitions, rules }).inspect(text);
}

test("grapheme masks preserve clusters and overflow hides everything", () => {
  const definitions = [detector("sample", /A👩‍💻e\u0301Z/u)];
  expect(
    run(
      definitions,
      { sample: { action: "mask", preserve: { first: 1, last: 1 } } },
      "A👩‍💻e\u0301Z",
    ).text,
  ).toBe("A**Z");
  expect(
    run([detector("sample", /abcdef/)], {
      sample: { action: "mask", preserve: { first: 4, last: 4 } },
    }).text,
  ).toBe("******");
});

test("overlapping masks union hidden graphemes", () => {
  const result = run([detector("a", /abcd/), detector("b", /cdef/)], {
    a: { action: "mask", preserve: { first: 1 } },
    b: { action: "mask", preserve: { last: 1 } },
  });
  expect(result.text).toBe("a****f");
  expect(result.groups).toHaveLength(1);
  expect(result.groups[0]?.matches.map((match) => match.value)).toEqual([
    "abcd",
    "cdef",
  ]);
});

test("remove wins over redact over mask through transitive overlaps", () => {
  const definitions = [
    detector("a", /abc/),
    detector("b", /cde/),
    detector("c", /ef/),
  ];
  expect(
    run(definitions, {
      a: { action: "mask" },
      b: { action: "redact" },
      c: { action: "remove" },
    }).text,
  ).toBe("");
  expect(
    run(definitions, {
      a: { action: "mask" },
      b: { action: "redact" },
      c: { action: "mask" },
    }).text,
  ).toBe("<b>");
});

test("redaction priority and tie fallback are deterministic", () => {
  const definitions = [detector("a", /abcd/), detector("b", /cdef/)];
  expect(
    run(definitions, { a: { action: "redact" }, b: { action: "redact" } }).text,
  ).toBe("[REDACTED]");
  expect(
    run(definitions, {
      a: { action: "redact", priority: 1, replacement: "winner" },
      b: { action: "redact" },
    }).text,
  ).toBe("winner");
  expect(
    run(definitions, {
      a: { action: "redact", replacement: "same" },
      b: { action: "redact", replacement: "same" },
    }).text,
  ).toBe("same");
});

test("adjacent matches are separate and outside text stays exact", () => {
  const result = run(
    [detector("a", /ab/), detector("b", /cd/)],
    { a: { action: "remove" }, b: { action: "redact" } },
    " abcd ",
  );
  expect(result.text).toBe(" <b> ");
  expect(result.groups).toHaveLength(2);
});

test("custom validators receive only declared context and non-SensoredError errors propagate", () => {
  const definition: DetectorDefinition = {
    ...detector("a", /abc/),
    context: { before: 2, after: 1 },
    validate(candidate) {
      expect(candidate).toEqual({ value: "abc", before: "12", after: "3" });
      return ["sample.context"];
    },
  };
  expect(run([definition], { a: { action: "redact" } }, "012abc345").text).toBe(
    "012<a>345",
  );
  expect(() =>
    run(
      [
        {
          ...definition,
          validate() {
            throw new Error("private-value");
          },
        },
      ],
      { a: { action: "redact" } },
    ),
  ).toThrow("private-value");
});

test("zero-width and split-grapheme custom matches fail", () => {
  for (const [pattern, text] of [
    [/(?:)/, "abc"],
    [/e/, "e\u0301"],
    [/👩/u, "👩‍💻"],
  ] as const) {
    expect(() =>
      run([detector("a", pattern)], { a: { action: "redact" } }, text),
    ).toThrow(SensoredError);
  }
});

test("registration snapshots regex and rule preservation settings", () => {
  const preserve = { first: 1 };
  const pattern = /abc/g;
  pattern.lastIndex = 100;
  const instance = createRedactor({
    detectors: [detector("a", pattern)],
    rules: { a: { action: "mask", preserve } },
  });
  preserve.first = 100;
  expect(instance.redact("abc abc")).toBe("a** a**");
});

test("inherited selections are not explicit rules", () => {
  expect(() =>
    createRedactor({ rules: Object.create({ email: { action: "redact" } }) }),
  ).toThrow(SensoredError);
});
