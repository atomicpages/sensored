import { describe, expect, test } from "bun:test";
import {
  buildPlaygroundRules,
  changePreset,
  createMatchDetails,
  createPlaygroundState,
  generatePlaygroundCode,
  PLAYGROUND_INPUT_LIMIT,
  PLAYGROUND_PRESETS,
  PLAYGROUND_SAMPLE,
  PLAYGROUND_SAMPLE_OUTPUT,
  PLAYGROUND_TEMPLATES,
  parseAllowlist,
  validatePlaygroundInput,
} from "../../../docs/.vitepress/theme/playground";
import {
  savePlaygroundHandoff,
  takePlaygroundHandoff,
} from "../../../docs/.vitepress/theme/playground-handoff";
import { createRedactor } from "../src";

describe("playground state", () => {
  test("starts with conversion-focused defaults", () => {
    const state = createPlaygroundState();

    expect(state.preset).toBe("pii");
    expect(state.action).toBe("redact");
    expect(state.input.length).toBeGreaterThan(0);
  });

  test("keeps the static fallback aligned with local redaction", () => {
    const redactor = createRedactor({ presets: ["pii"], rules: {} });

    expect(redactor.redact(PLAYGROUND_SAMPLE)).toBe(PLAYGROUND_SAMPLE_OUTPUT);
  });

  test("provides a matching template for every preset", () => {
    expect(Object.keys(PLAYGROUND_TEMPLATES)).toEqual([...PLAYGROUND_PRESETS]);

    for (const preset of PLAYGROUND_PRESETS) {
      const redactor = createRedactor({ presets: [preset], rules: {} });

      expect(redactor.redact(PLAYGROUND_TEMPLATES[preset])).not.toBe(
        PLAYGROUND_TEMPLATES[preset],
      );
    }
  });

  test("changing preset replaces pristine template input", () => {
    const hipaa = changePreset(createPlaygroundState(), "hipaa");
    const finance = changePreset(hipaa, "finance");

    expect(hipaa.input).toBe(PLAYGROUND_TEMPLATES.hipaa);
    expect(finance.input).toBe(PLAYGROUND_TEMPLATES.finance);
  });

  test("changing preset preserves user-modified input", () => {
    const state = {
      ...createPlaygroundState(),
      input: "Keep this custom input",
      action: "mask" as const,
      allowlist: ["example.com"],
      disabledDetectors: new Set(["email"]),
      nerEnabled: true,
    };

    const changed = changePreset(state, "hipaa", true);

    expect(changed).toMatchObject({
      input: "Keep this custom input",
      preset: "hipaa",
      action: "mask",
      allowlist: ["example.com"],
      nerEnabled: false,
    });
    expect(changed.disabledDetectors.size).toBe(0);
  });

  test("parses unique exact allowlist entries", () => {
    expect(
      parseAllowlist(
        "alice@example.com\n\n Alice@example.com \nalice@example.com",
      ),
    ).toEqual(["alice@example.com", "Alice@example.com"]);
  });

  test("builds global actions and replaces lite names with NER", () => {
    const state = {
      ...createPlaygroundState(),
      action: "remove" as const,
      disabledDetectors: new Set(["phone"]),
      nerEnabled: true,
    };

    expect(
      buildPlaygroundRules(["email", "phone", "person_name_lite"], state, {
        email: 20,
      }),
    ).toEqual({
      email: { action: "remove" },
      phone: "off",
      person_name_lite: "off",
      person_name: { action: "remove" },
    });
  });

  test("preserves preset priorities for redact actions", () => {
    expect(
      buildPlaygroundRules(["email"], createPlaygroundState(), { email: 20 }),
    ).toEqual({
      email: { action: "redact", priority: 20 },
    });
  });

  test("enforces the live input limit in UTF-16 code units", () => {
    expect(validatePlaygroundInput("a".repeat(PLAYGROUND_INPUT_LIMIT))).toBe(
      undefined,
    );
    expect(
      validatePlaygroundInput("a".repeat(PLAYGROUND_INPUT_LIMIT + 1)),
    ).toContain("50,000");
  });

  test("masks inspected values completely", () => {
    const details = createMatchDetails([
      {
        matches: [
          {
            entityType: "email",
            ruleId: "email",
            start: 0,
            end: 17,
            reasons: ["email.regex"],
            value: "alice@example.com",
          },
        ],
      },
    ]);

    expect(details[0]).toMatchObject({
      entityType: "email",
      preview: "••••••••••••",
    });
    expect(details[0]?.preview).not.toContain("alice");
  });

  test("generates code matching active controls", () => {
    const state = {
      ...createPlaygroundState(),
      allowlist: ["public@example.com"],
      nerEnabled: true,
    };
    const code = generatePlaygroundCode(["email", "person_name_lite"], state);

    expect(code).toContain("preloadPersonNameDetector");
    expect(code).toContain('presets: ["pii"]');
    expect(code).toContain('"person_name_lite": "off"');
    expect(code).toContain('"public@example.com"');
  });

  test("hands state off once without persistence", () => {
    savePlaygroundHandoff({
      input: "Email alice@example.com",
      preset: "security",
      action: "mask",
    });

    expect(takePlaygroundHandoff()).toEqual({
      input: "Email alice@example.com",
      preset: "security",
      action: "mask",
    });
    expect(takePlaygroundHandoff()).toBeUndefined();
  });
});
