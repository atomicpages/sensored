import { describe, expect, test } from "bun:test";
import { createRedactor, SensoredError } from "../src";

describe("pii preset", () => {
  test("creates a redactor with 96 redact rules", () => {
    const redactor = createRedactor({ presets: ["pii"], rules: {} });

    expect(Object.keys(redactor.policy).length).toBe(96);

    for (const setting of Object.values(redactor.policy)) {
      expect(setting).toEqual({ action: "redact" });
    }
  });

  test("redacts email, payment_card, and us_ssn", () => {
    const redactor = createRedactor({
      presets: ["pii"],
      rules: { postal_code: "off" },
    });

    expect(redactor.redact("Email: alice@example.com")).toBe("Email: [EMAIL]");
    expect(redactor.redact("Card: 4242 4242 4242 4242")).toBe(
      "Card: [PAYMENT_CARD]",
    );
    expect(redactor.redact("SSN: 123-45-6789")).toBe("SSN: [US_SSN]");
  });

  test("policy is frozen", () => {
    const redactor = createRedactor({ presets: ["pii"], rules: {} });

    expect(Object.isFrozen(redactor.policy)).toBe(true);
    expect(Object.isFrozen(redactor.policy.email)).toBe(true);
  });
});

describe("explicit overrides on presets", () => {
  test("override payment_card to mask with preserve", () => {
    const redactor = createRedactor({
      presets: ["pii"],
      rules: {
        payment_card: { action: "mask", preserve: { last: 4 } },
        postal_code: "off",
      },
    });

    expect(redactor.policy.payment_card).toEqual({
      action: "mask",
      preserve: { last: 4 },
    });
    expect(redactor.policy.email).toEqual({ action: "redact" });
    expect(redactor.policy.us_ssn).toEqual({ action: "redact" });
    expect(redactor.redact("Card: 4242 4242 4242 4242")).toBe(
      "Card: ***************4242",
    );
  });

  test("disable us_ssn with off", () => {
    const redactor = createRedactor({
      presets: ["pii"],
      rules: { us_ssn: "off", postal_code: "off" },
    });

    expect(redactor.policy.us_ssn).toBeUndefined();
    expect(redactor.policy.email).toEqual({ action: "redact" });
    expect(redactor.policy.payment_card).toEqual({ action: "redact" });
    expect(redactor.redact("SSN: 123-45-6789")).toBe("SSN: 123-45-6789");
  });

  test("override email to remove", () => {
    const redactor = createRedactor({
      presets: ["pii"],
      rules: { email: { action: "remove" } },
    });

    expect(redactor.policy.email).toEqual({ action: "remove" });
    expect(redactor.redact("Email: alice@example.com")).toBe("Email: ");
  });

  test("explicit rules can introduce new rules not in any preset", () => {
    const redactor = createRedactor({
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
        us_ssn: { action: "redact" },
      },
    });

    expect(Object.keys(redactor.policy).sort()).toEqual([
      "email",
      "payment_card",
      "us_ssn",
    ]);
  });
});

describe("preset conflicts", () => {
  test("two custom presets with same rule and different actions throw POLICY_CONFLICT", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          a: { email: { action: "redact" } },
          b: { email: { action: "mask" } },
        },
        presets: ["a", "b"],
        rules: {},
      }),
    ).toThrow(SensoredError);

    try {
      createRedactor({
        customPresets: {
          a: { email: { action: "redact" } },
          b: { email: { action: "mask" } },
        },
        presets: ["a", "b"],
        rules: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect(error).toMatchObject({ code: "POLICY_CONFLICT", path: "presets" });
    }
  });

  test("two custom presets with same rule and same action do not conflict", () => {
    const redactor = createRedactor({
      customPresets: {
        a: { email: { action: "redact" } },
        b: { email: { action: "redact" } },
      },
      presets: ["a", "b"],
      rules: {},
    });

    expect(redactor.policy.email).toEqual({ action: "redact" });
  });

  test("custom preset + explicit override with different action does not conflict", () => {
    const redactor = createRedactor({
      customPresets: {
        a: { email: { action: "redact" } },
      },
      presets: ["a"],
      rules: { email: { action: "mask" } },
    });

    expect(redactor.policy.email).toEqual({ action: "mask" });
  });

  test("conflict between redact and remove actions", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          a: { email: { action: "redact" } },
          b: { email: { action: "remove" } },
        },
        presets: ["a", "b"],
        rules: {},
      }),
    ).toThrow(SensoredError);
  });

  test("conflict between mask and remove actions", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          a: { email: { action: "mask" } },
          b: { email: { action: "remove" } },
        },
        presets: ["a", "b"],
        rules: {},
      }),
    ).toThrow(SensoredError);
  });
});

describe("custom presets", () => {
  test("custom preset overrides built-in with same name", () => {
    const redactor = createRedactor({
      customPresets: {
        pii: {
          email: { action: "remove" },
        },
      },
      presets: ["pii"],
      rules: {},
    });

    expect(redactor.policy.email).toEqual({ action: "remove" });
    expect(redactor.policy.payment_card).toBeUndefined();
    expect(redactor.policy.us_ssn).toBeUndefined();
  });

  test("custom preset with off skips rule without disabling from another preset", () => {
    const redactor = createRedactor({
      customPresets: {
        a: { email: { action: "redact" } },
        b: { email: "off" },
      },
      presets: ["a", "b"],
      rules: {},
    });

    expect(redactor.policy.email).toEqual({ action: "redact" });
  });

  test("explicit off disables rule from preset", () => {
    const redactor = createRedactor({
      customPresets: {
        a: {
          email: { action: "redact" },
          payment_card: { action: "redact" },
        },
      },
      presets: ["a"],
      rules: { email: "off" },
    });

    expect(redactor.policy.email).toBeUndefined();
    expect(redactor.policy.payment_card).toEqual({ action: "redact" });
  });

  test("custom preset combined with pii (same action, no conflict)", () => {
    const redactor = createRedactor({
      customPresets: {
        extra: { email: { action: "redact", replacement: "[EMAIL]" } },
      },
      presets: ["pii", "extra"],
      rules: {},
    });

    expect(redactor.policy.email).toEqual({
      action: "redact",
      replacement: "[EMAIL]",
    });
    expect(redactor.policy.payment_card).toEqual({ action: "redact" });
    expect(redactor.policy.us_ssn).toEqual({ action: "redact" });
  });
});

describe("unknown presets", () => {
  test("unknown preset name throws error", () => {
    expect(() => createRedactor({ presets: ["unknown"], rules: {} })).toThrow(
      SensoredError,
    );

    try {
      createRedactor({ presets: ["unknown"], rules: {} });
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect(error).toMatchObject({ code: "UNKNOWN_RULE", path: "presets" });
    }
  });

  test("unknown preset after valid preset throws error", () => {
    expect(() =>
      createRedactor({ presets: ["pii", "unknown"], rules: {} }),
    ).toThrow(SensoredError);
  });
});

describe("empty policy from presets", () => {
  test("all rules disabled via explicit overrides throws EMPTY_POLICY", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          minimal: {
            email: { action: "redact" },
            payment_card: { action: "redact" },
            us_ssn: { action: "redact" },
          },
        },
        presets: ["minimal"],
        rules: {
          email: "off",
          payment_card: "off",
          us_ssn: "off",
        },
      }),
    ).toThrow(SensoredError);

    try {
      createRedactor({
        customPresets: {
          minimal: {
            email: { action: "redact" },
            payment_card: { action: "redact" },
            us_ssn: { action: "redact" },
          },
        },
        presets: ["minimal"],
        rules: {
          email: "off",
          payment_card: "off",
          us_ssn: "off",
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect(error).toMatchObject({ code: "EMPTY_POLICY", path: "rules" });
    }
  });
});

describe("preset validation", () => {
  test("presets must be an array of strings", () => {
    expect(() =>
      createRedactor({
        presets: "pii" as unknown as string[],
        rules: {},
      }),
    ).toThrow(SensoredError);

    expect(() =>
      createRedactor({
        presets: [123] as unknown as string[],
        rules: {},
      }),
    ).toThrow(SensoredError);

    expect(() =>
      createRedactor({
        presets: [""] as unknown as string[],
        rules: {},
      }),
    ).toThrow(SensoredError);
  });

  test("customPresets must be a record", () => {
    expect(() =>
      createRedactor({
        customPresets: "not a record" as unknown as Record<string, never>,
        rules: {},
      }),
    ).toThrow(SensoredError);

    expect(() =>
      createRedactor({
        customPresets: [] as unknown as Record<string, never>,
        rules: {},
      }),
    ).toThrow(SensoredError);
  });

  test("customPresets with invalid preset name throws", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          "Invalid Name": { email: { action: "redact" } },
        },
        presets: ["Invalid Name"],
        rules: {},
      }),
    ).toThrow(SensoredError);
  });

  test("customPresets with invalid rule setting throws", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          a: { email: { action: "invalid" as unknown as "redact" } },
        },
        presets: ["a"],
        rules: {},
      }),
    ).toThrow(SensoredError);
  });
});

describe("policy inspection", () => {
  test("policy shows final resolved settings from preset + overrides", () => {
    const redactor = createRedactor({
      presets: ["pii"],
      rules: {
        email: { action: "mask", preserve: { first: 1 } },
        us_ssn: "off",
      },
    });

    expect(redactor.policy.email).toEqual({
      action: "mask",
      preserve: { first: 1 },
    });
    expect(redactor.policy.payment_card).toEqual({ action: "redact" });
    expect(redactor.policy.us_ssn).toBeUndefined();
  });

  test("policy is immutable", () => {
    const redactor = createRedactor({ presets: ["pii"], rules: {} });

    expect(() => {
      (redactor.policy as Record<string, unknown>).email = { action: "remove" };
    }).toThrow();

    expect(() => {
      (redactor.policy as Record<string, unknown>).newRule = {
        action: "redact",
      };
    }).toThrow();
  });
});

describe("compliance presets", () => {
  test("pii preset expands to 96 rules with redact action", () => {
    const redactor = createRedactor({ presets: ["pii"], rules: {} });

    expect(Object.keys(redactor.policy).length).toBe(96);

    for (const setting of Object.values(redactor.policy)) {
      expect(setting).toEqual({ action: "redact" });
    }
  });

  test("gdpr preset expands to 39 rules with redact action", () => {
    const redactor = createRedactor({ presets: ["gdpr"], rules: {} });

    expect(Object.keys(redactor.policy).length).toBe(39);

    for (const setting of Object.values(redactor.policy)) {
      expect(setting).toEqual({ action: "redact" });
    }
  });

  test("hipaa preset expands to 29 rules with redact action", () => {
    const redactor = createRedactor({ presets: ["hipaa"], rules: {} });

    expect(Object.keys(redactor.policy).length).toBe(29);

    for (const setting of Object.values(redactor.policy)) {
      expect(setting).toEqual({ action: "redact" });
    }
  });

  test("ccpa preset expands to 86 rules with redact action", () => {
    const redactor = createRedactor({ presets: ["ccpa"], rules: {} });

    expect(Object.keys(redactor.policy).length).toBe(86);

    for (const setting of Object.values(redactor.policy)) {
      expect(setting).toEqual({ action: "redact" });
    }
  });

  test("pci-dss preset expands to 6 rules with redact action", () => {
    const redactor = createRedactor({ presets: ["pci-dss"], rules: {} });

    expect(Object.keys(redactor.policy).sort()).toEqual([
      "card_data",
      "financial_reference",
      "iban",
      "investment_account",
      "payment_card",
      "payment_gateway_id",
    ]);

    for (const setting of Object.values(redactor.policy)) {
      expect(setting).toEqual({ action: "redact" });
    }
  });

  test("gdpr preset does not include payment_card", () => {
    const redactor = createRedactor({ presets: ["gdpr"], rules: {} });

    expect(redactor.policy.payment_card).toBeUndefined();
  });

  test("pci-dss preset does not include email or phone", () => {
    const redactor = createRedactor({ presets: ["pci-dss"], rules: {} });

    expect(redactor.policy.email).toBeUndefined();
    expect(redactor.policy.phone).toBeUndefined();
  });
});

describe("compliance preset overrides", () => {
  test("override email to mask in pii preset", () => {
    const redactor = createRedactor({
      presets: ["pii"],
      rules: { email: { action: "mask", preserve: { first: 1 } } },
    });

    expect(redactor.policy.email).toEqual({
      action: "mask",
      preserve: { first: 1 },
    });
    expect(redactor.policy.phone).toEqual({ action: "redact" });
  });

  test("disable passport from hipaa preset with off", () => {
    const redactor = createRedactor({
      presets: ["hipaa"],
      rules: { passport: "off" },
    });

    expect(redactor.policy.passport).toBeUndefined();
    expect(redactor.policy.email).toEqual({ action: "redact" });
  });

  test("disable payment_card from pci-dss preset with off", () => {
    const redactor = createRedactor({
      presets: ["pci-dss"],
      rules: { payment_card: "off" },
    });

    expect(redactor.policy.payment_card).toBeUndefined();
    expect(redactor.policy.iban).toEqual({ action: "redact" });
  });

  test("combine pii and pci-dss presets (same action, no conflict)", () => {
    const redactor = createRedactor({
      presets: ["pii", "pci-dss"],
      rules: {},
    });

    expect(redactor.policy.payment_card).toEqual({ action: "redact" });
    expect(redactor.policy.iban).toEqual({ action: "redact" });
    expect(redactor.policy.email).toEqual({ action: "redact" });
  });

  test("combine hipaa and gdpr presets (same action, no conflict)", () => {
    const redactor = createRedactor({
      presets: ["hipaa", "gdpr"],
      rules: {},
    });

    expect(redactor.policy.email).toEqual({ action: "redact" });
    expect(redactor.policy.iban).toEqual({ action: "redact" });
    expect(redactor.policy.passport).toEqual({ action: "redact" });
  });

  test("all rules disabled from ccpa preset throws EMPTY_POLICY", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          minimal: {
            email: { action: "redact" },
            phone: { action: "redact" },
            payment_card: { action: "redact" },
            us_ssn: { action: "redact" },
            person_name_lite: { action: "redact" },
          },
        },
        presets: ["minimal"],
        rules: {
          email: "off",
          phone: "off",
          payment_card: "off",
          us_ssn: "off",
          person_name_lite: "off",
        },
      }),
    ).toThrow(SensoredError);
  });
});

describe("compliance preset conflicts", () => {
  test("pii and custom preset with conflicting email action throws", () => {
    expect(() =>
      createRedactor({
        customPresets: {
          custom: { email: { action: "mask" } },
        },
        presets: ["pii", "custom"],
        rules: {},
      }),
    ).toThrow(SensoredError);

    try {
      createRedactor({
        customPresets: {
          custom: { email: { action: "mask" } },
        },
        presets: ["pii", "custom"],
        rules: {},
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SensoredError);
      expect(error).toMatchObject({ code: "POLICY_CONFLICT", path: "presets" });
    }
  });
});
