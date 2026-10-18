import type { ErrorSeed } from "../reference";

const EMAIL_RULE = { email: { action: "redact" } };

/** A valid config with one top-level field replaced. */
function withField(field: string, name: string, value: unknown): ErrorSeed {
  return {
    id: `invalid-config/${field}/${name}`,
    config: { rules: EMAIL_RULE, [field]: value },
  };
}

/** A valid config whose `email` rule setting is replaced. */
function withSetting(name: string, setting: unknown): ErrorSeed {
  return {
    id: `invalid-config/rules/${name}`,
    config: { rules: { email: setting } },
  };
}

export const errorSeeds: readonly ErrorSeed[] = [
  // INVALID_CONFIG: top-level shape
  { id: "invalid-config/root/null", config: null },
  { id: "invalid-config/root/array", config: [] },
  { id: "invalid-config/root/string", config: "email" },
  { id: "invalid-config/root/missing-rules", config: {} },
  { id: "invalid-config/root/rules-array", config: { rules: [] } },
  { id: "invalid-config/root/rules-null", config: { rules: null } },
  {
    id: "invalid-config/root/unknown-key",
    config: { rules: EMAIL_RULE, rule: {} },
  },

  // INVALID_CONFIG: rule settings
  withSetting("setting-string", "redact"),
  withSetting("setting-null", null),
  withSetting("unknown-action", { action: "hash" }),
  withSetting("missing-action", { replacement: "x" }),
  withSetting("redact-replacement-number", {
    action: "redact",
    replacement: 1,
  }),
  withSetting("redact-priority-float", { action: "redact", priority: 1.5 }),
  withSetting("redact-priority-string", { action: "redact", priority: "1" }),
  withSetting("redact-extra-key", { action: "redact", preserve: { first: 1 } }),
  withSetting("mask-preserve-array", { action: "mask", preserve: [1] }),
  withSetting("mask-preserve-extra-key", {
    action: "mask",
    preserve: { middle: 1 },
  }),
  withSetting("mask-preserve-negative", {
    action: "mask",
    preserve: { first: -1 },
  }),
  withSetting("mask-preserve-float", {
    action: "mask",
    preserve: { last: 0.5 },
  }),
  withSetting("token-replace-tokens-array", {
    action: "token-replace",
    tokens: ["x"],
  }),
  withSetting("token-replace-token-number", {
    action: "token-replace",
    tokens: { email: 1 },
  }),
  withSetting("token-replace-empty-key", {
    action: "token-replace",
    tokens: { "": "x" },
  }),
  withSetting("format-preserve-extra-key", {
    action: "format-preserve",
    replacement: "x",
  }),
  withSetting("remove-extra-key", { action: "remove", priority: 1 }),

  // INVALID_CONFIG: other fields
  withField("presets", "string", "pii"),
  withField("presets", "empty-name", [""]),
  withField("presets", "non-string-name", [1]),
  withField("customPresets", "array", []),
  withField("customPresets", "uppercase-name", { Team: EMAIL_RULE }),
  withField("customPresets", "digit-first-name", { "1team": EMAIL_RULE }),
  withField("customPresets", "rules-array", { team: [] }),
  withField("customPresets", "empty-rule-id", {
    team: { "": { action: "redact" } },
  }),
  withField("customPresets", "invalid-setting", {
    team: { email: { action: "hash" } },
  }),
  withField("restore", "string", "true"),
  withField("allowlist", "string", "a@example.com"),
  withField("allowlist", "empty-entry", [""]),
  withField("allowlist", "non-string-entry", [1]),
  withField("limits", "number", 10),
  withField("limits", "unknown-key", { maxLength: 10 }),
  withField("limits", "zero", { maxInputLength: 0 }),
  withField("limits", "negative", { maxInputLength: -1 }),
  withField("limits", "float", { maxInputLength: 1.5 }),
  withField("detectorOptions", "array", []),
  withField("detectorOptions", "unknown-detector", { email: {} }),
  withField("detectorOptions", "http-auth-header-array", {
    http_auth_header: [],
  }),
  withField("detectorOptions", "http-auth-header-unknown-key", {
    http_auth_header: { headers: [] },
  }),
  withField("detectorOptions", "custom-headers-empty", {
    http_auth_header: { customHeaders: [] },
  }),
  withField("detectorOptions", "custom-headers-string", {
    http_auth_header: { customHeaders: "X-Example-Auth" },
  }),
  withField("detectorOptions", "custom-headers-empty-entry", {
    http_auth_header: { customHeaders: [""] },
  }),
  withField("detectorOptions", "custom-headers-non-string", {
    http_auth_header: { customHeaders: [1] },
  }),
  withField("detectors", "object", {}),
  withField("detectors", "json-definition", [{}]),
  withField("semantic", "empty", {}),
  {
    id: "invalid-config/detectOnly/with-restore",
    config: { rules: EMAIL_RULE, detectOnly: true, restore: true },
  },

  // UNKNOWN_RULE
  {
    id: "unknown-rule/rules/unknown-id",
    config: { rules: { not_a_rule: { action: "redact" } } },
  },
  {
    id: "unknown-rule/rules/unknown-id-off",
    config: { rules: { email: { action: "redact" }, not_a_rule: "off" } },
  },
  {
    id: "unknown-rule/rules/custom-preset-unknown-id",
    config: {
      presets: ["team"],
      customPresets: { team: { not_a_rule: { action: "redact" } } },
      rules: {},
    },
  },
  {
    id: "unknown-rule/presets/unknown-name",
    config: { presets: ["not-a-preset"], rules: {} },
  },
  {
    id: "unknown-rule/presets/version-out-of-range",
    config: { presets: ["pii@2"], rules: {} },
  },
  {
    id: "unknown-rule/presets/version-zero",
    config: { presets: ["pii@0"], rules: {} },
  },
  {
    id: "unknown-rule/presets/version-not-numeric",
    config: { presets: ["pii@latest"], rules: {} },
  },
  {
    id: "unknown-rule/presets/version-leading-plus",
    config: { presets: ["pii@+1"], rules: {} },
  },
  {
    id: "unknown-rule/presets/empty-name-with-version",
    config: { presets: ["@1"], rules: {} },
  },
  {
    id: "unknown-rule/presets/custom-preset-with-version",
    config: {
      presets: ["team@1"],
      customPresets: { team: EMAIL_RULE },
      rules: {},
    },
  },

  // EMPTY_POLICY
  { id: "empty-policy/no-rules", config: { rules: {} } },
  { id: "empty-policy/all-off", config: { rules: { email: "off" } } },
  {
    id: "empty-policy/preset-rule-turned-off",
    config: {
      presets: ["team"],
      customPresets: { team: EMAIL_RULE },
      rules: { email: "off" },
    },
  },
  {
    id: "empty-policy/custom-preset-only-off",
    config: {
      presets: ["team"],
      customPresets: { team: { email: "off" } },
      rules: {},
    },
  },

  // POLICY_CONFLICT
  {
    id: "policy-conflict/custom-vs-builtin",
    config: {
      presets: ["pci-dss", "team"],
      customPresets: { team: { payment_card: { action: "mask" } } },
      rules: {},
    },
  },
  {
    id: "policy-conflict/explicit-override-does-not-resolve",
    config: {
      presets: ["pci-dss", "team"],
      customPresets: { team: { payment_card: { action: "mask" } } },
      rules: { payment_card: { action: "remove" } },
    },
  },

  // INPUT_LIMIT
  {
    id: "input-limit/max-input-length",
    config: { rules: EMAIL_RULE, limits: { maxInputLength: 8 } },
    input: "123456789",
  },
  {
    id: "input-limit/counts-utf16-units",
    config: { rules: EMAIL_RULE, limits: { maxInputLength: 3 } },
    input: "😀😀",
  },
];
