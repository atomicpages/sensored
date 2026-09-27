import { describe, expect, test } from "bun:test";
import {
  evaluate,
  parseBaseline,
  parseCorpus,
  releaseGate,
  EVAL_RULES,
} from "./evaluator.ts";

function first<T>(items: T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error("Empty fixture");
  }
  return item;
}

const fixture = () =>
  parseCorpus({
    revision: "synthetic-v1",
    provenance: "synthetic",
    reviewed: false,
    rules: ["email", "payment_card"],
    cases: [
      {
        id: "a",
        text: "synthetic-a",
        kind: "supported",
        expected: [{ ruleId: "email", start: 0, end: 5 }],
      },
      { id: "b", text: "synthetic-b", kind: "negative", expected: [] },
      { id: "c", text: "unsupported-format", kind: "deferred", expected: [] },
    ],
  });

describe("synthetic evaluator self-tests (not independent evaluation)", () => {
  test("exact tuples, wrong spans, per-rule and aggregate undefined metrics", async () => {
    const report = await evaluate(fixture(), () => [
      { ruleId: "email", start: 0, end: 4 },
    ]);
    expect(report.rules.email).toEqual({
      tp: 0,
      fp: 2,
      fn: 1,
      precision: 0,
      recall: 0,
    });
    expect(report.rules.payment_card).toEqual({
      tp: 0,
      fp: 0,
      fn: 0,
      precision: null,
      recall: null,
    });
    expect(report.micro).toEqual({
      tp: 0,
      fp: 2,
      fn: 1,
      precision: 0,
      recall: 0,
    });
    expect(report.macro).toEqual({ precision: null, recall: null });
    expect(report.documents).toEqual({
      scored: 2,
      negative: 1,
      deferred: 1,
      falsePositiveRate: 1,
      lengths: [11, 11],
    });
    expect(JSON.stringify(report)).not.toContain("synthetic-a");
    expect(JSON.stringify(report)).not.toContain("unsupported-format");
  });
  test("exact accepted detections and report regression comparison", async () => {
    const corpus = fixture();
    const baseline = await evaluate(corpus, (text) =>
      text === "synthetic-a" ? [{ ruleId: "email", start: 0, end: 5 }] : [],
    );
    expect(baseline.rules.email?.precision).toBe(1);
    expect(baseline.rules.email?.recall).toBe(1);
    const after = await evaluate(corpus, () => []);
    expect(releaseGate(after, parseBaseline(baseline))).toContain(
      "Regression: a",
    );
    first(corpus.cases).expected = [];
    expect(
      releaseGate(
        await evaluate(corpus, () => []),
        baseline,
      ),
    ).toContain("Corpus changed; owner review and a new baseline are required");
  });
  test("release gate stays closed without independent data and baseline", async () => {
    const failures = releaseGate(await evaluate(fixture(), () => []));
    expect(failures).toContain("Independent owner-reviewed corpus is missing");
    expect(failures).toContain("Reviewed baseline is missing");
    expect(failures).toContain("At least 1000 negative documents required");
    expect(failures).toContain("Coverage or quality target unmet: email");
  });
  test("invalid labels and duplicated cases or tuples fail closed", async () => {
    const corpus = fixture();
    corpus.cases.push(first(corpus.cases));
    expect(() => parseCorpus(corpus)).toThrow("Duplicate");
    const invalid = fixture();
    first(first(invalid.cases).expected).end = 100;
    expect(() => parseCorpus(invalid)).toThrow("Invalid detection tuple");
    expect(
      async () =>
        await evaluate(fixture(), () => [
          { ruleId: "unknown", start: 0, end: 1 },
        ]),
    ).toThrow();
    expect(
      async () =>
        await evaluate(fixture(), () => [
          { ruleId: "email", start: 0, end: 1 },
          { ruleId: "email", start: 0, end: 1 },
        ]),
    ).toThrow("Duplicate");
    expect(() => parseBaseline({ version: 1, fingerprint: "x" })).toThrow();
  });
  test("micro and macro scores reflect different per-detector support", async () => {
    const corpus = parseCorpus({
      revision: "synthetic-v2",
      provenance: "synthetic",
      reviewed: false,
      rules: ["email", "payment_card"],
      cases: [
        {
          id: "a",
          text: "abcdef",
          kind: "supported",
          expected: [
            { ruleId: "email", start: 0, end: 1 },
            { ruleId: "email", start: 1, end: 2 },
            { ruleId: "payment_card", start: 2, end: 3 },
          ],
        },
      ],
    });
    const report = await evaluate(corpus, () => [
      { ruleId: "email", start: 0, end: 1 },
      { ruleId: "payment_card", start: 2, end: 3 },
    ]);
    expect(report.micro.recall).toBe(2 / 3);
    expect(report.macro.recall).toBe(0.75);
  });
});

test("new errors are regressions even when counts stay unchanged", async () => {
  const corpus = fixture();
  const before = await evaluate(corpus, () => [
    { ruleId: "email", start: 0, end: 4 },
  ]);
  const after = await evaluate(corpus, () => [{ ruleId: "email", start: 1, end: 5 }]);
  expect(after.micro).toEqual(before.micro);
  expect(releaseGate(after, parseBaseline(before))).toContain("Regression: a");
  expect(releaseGate(after, parseBaseline(before))).toContain(
    "Baseline must use owner-reviewed independent data",
  );
});

test("synthetic gate simulation verifies the success path, not independent evidence", async () => {
  const cases = Array.from({ length: 1000 }, (_, index) => ({
    id: `n-${index}`,
    text: "ordinary",
    kind: "negative",
    expected: [],
  }));
  const rules = [...EVAL_RULES];
  const positives = rules.flatMap((ruleId) =>
    Array.from({ length: 200 }, (_, index) => ({
      id: `${ruleId}-${index}`,
      text: ruleId,
      kind: "supported",
      expected: [{ ruleId, start: 0, end: ruleId.length }],
    })),
  );
  const corpus = parseCorpus({
    revision: "synthetic-gate-simulation",
    provenance: "independent",
    reviewed: true,
    rules,
    cases: [...cases, ...positives],
  });
  const report = await evaluate(corpus, (text) =>
    rules.includes(text) ? [{ ruleId: text, start: 0, end: text.length }] : [],
  );
  expect(releaseGate(report, parseBaseline(report))).toEqual([]);
});
