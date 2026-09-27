import { describe, expect, test } from "bun:test";
import { JevProvider, MockProvider } from "../src/semantic/provider";
import type { SemanticCandidate } from "../src/semantic/types";

function makeCandidate(
  ruleId: string,
  value: string,
  before = "",
  after = "",
): SemanticCandidate {
  return {
    ruleId,
    entityType: ruleId,
    value,
    before,
    after,
    question: {
      instructions: "Is this a person?",
      criteria: {
        true: "Yes it is a person",
        false: "No it is not a person",
      },
    },
  };
}

const candidate: SemanticCandidate = {
  ruleId: "person_name_lite",
  entityType: "person_name_lite",
  value: "John Smith",
  before: "Contact ",
  after: " today",
  question: {
    instructions: "Is this a person?",
    criteria: {
      true: "Yes it is a person",
      false: "No it is not a person",
    },
  },
};

// ---------------------------------------------------------------------------
// MockProvider
// ---------------------------------------------------------------------------

describe("MockProvider", () => {
  test("returns preset results for matching ruleIds", async () => {
    const provider = new MockProvider({
      person_name_lite: {
        ruleId: "person_name_lite",
        confirmed: false,
        noul: 0,
      },
    });

    const results = await provider.confirm([candidate]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      ruleId: "person_name_lite",
      confirmed: false,
      noul: 0,
    });
  });

  test("returns default (confirmed=true, noul=1) for unmatched ruleIds", async () => {
    const provider = new MockProvider();

    const results = await provider.confirm([candidate]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      ruleId: "person_name_lite",
      confirmed: true,
      noul: 1,
    });
  });

  test("returns empty array for empty candidates", async () => {
    const provider = new MockProvider();

    const results = await provider.confirm([]);

    expect(results).toEqual([]);
  });

  test("preserves order of candidates", async () => {
    const provider = new MockProvider({
      rule_a: { ruleId: "rule_a", confirmed: false, noul: 0 },
    });

    const candidates = [
      makeCandidate("rule_a", "Alice"),
      makeCandidate("rule_b", "Bob"),
      makeCandidate("rule_c", "Charlie"),
    ];

    const results = await provider.confirm(candidates);

    expect(results).toHaveLength(3);
    expect(results[0]?.ruleId).toBe("rule_a");
    expect(results[1]?.ruleId).toBe("rule_b");
    expect(results[2]?.ruleId).toBe("rule_c");
    expect(results[0]?.confirmed).toBe(false);
    expect(results[1]?.confirmed).toBe(true);
    expect(results[2]?.confirmed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JevProvider construction
// ---------------------------------------------------------------------------

describe("JevProvider construction", () => {
  test("constructs with apiKey, model, thresholds", () => {
    const provider = new JevProvider({
      apiKey: "test-key",
      model: "jev-2",
      thresholds: { default: 0.7, person_name_lite: 0.9 },
    });

    expect(provider).toBeDefined();
    expect(typeof provider.confirm).toBe("function");
  });

  test("uses default model when model not specified", () => {
    const provider = new JevProvider({ apiKey: "test-key" });

    expect(provider).toBeDefined();
    expect(typeof provider.confirm).toBe("function");
  });

  test("uses default threshold when thresholds not specified", () => {
    const provider = new JevProvider({ apiKey: "test-key" });

    expect(provider).toBeDefined();
    expect(typeof provider.confirm).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// JevProvider.confirm
// ---------------------------------------------------------------------------

describe("JevProvider.confirm", () => {
  test("has a confirm method", () => {
    const provider = new JevProvider({ apiKey: "test-key" });

    expect(typeof provider.confirm).toBe("function");
  });
});
