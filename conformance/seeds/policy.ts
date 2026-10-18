import type { PolicySeed } from "../reference";
import { PRESET_NAMES } from "./presets";

export const policySeeds: readonly PolicySeed[] = [
  ...PRESET_NAMES.map((name) => ({
    id: `preset/${name}`,
    config: { presets: [name], rules: {} },
  })),
  {
    id: "preset-versioned/pii@1",
    config: { presets: ["pii@1"], rules: {} },
  },
  {
    id: "preset-versioned/security@1",
    config: { presets: ["security@1"], rules: {} },
  },
  {
    id: "combined/pii+security",
    config: { presets: ["pii", "security"], rules: {} },
  },
  {
    id: "combined/hipaa+pci-dss+finance",
    config: { presets: ["hipaa", "pci-dss", "finance"], rules: {} },
  },
  {
    id: "combined/duplicate-preset",
    config: { presets: ["pci-dss", "pci-dss"], rules: {} },
  },
  {
    id: "rules-only/single",
    config: { rules: { email: { action: "redact" } } },
  },
  {
    id: "rules-only/every-action",
    config: {
      rules: {
        email: { action: "redact", replacement: "<email>", priority: 2 },
        phone: { action: "mask", preserve: { first: 1, last: 2 } },
        payment_card: { action: "format-preserve" },
        ipv4: { action: "token-replace", tokens: { ipv4: "198.51.100.1" } },
        iban: { action: "remove" },
      },
    },
  },
  {
    id: "rules-only/off-is-dropped",
    config: { rules: { email: { action: "redact" }, ipv4: "off" } },
  },
  {
    id: "custom-preset/alone",
    config: {
      presets: ["team"],
      customPresets: {
        team: { email: { action: "mask" }, ipv4: { action: "redact" } },
      },
      rules: {},
    },
  },
  {
    id: "custom-preset/off-entry-is-skipped",
    config: {
      presets: ["pci-dss", "team"],
      customPresets: {
        team: { email: { action: "redact" }, payment_card: "off" },
      },
      rules: {},
    },
  },
  {
    id: "custom-preset/with-builtin-same-action",
    config: {
      presets: ["pci-dss", "team"],
      customPresets: {
        team: {
          email: { action: "redact" },
          payment_card: { action: "redact", replacement: "<card>" },
        },
      },
      rules: {},
    },
  },
  {
    id: "custom-preset/unused-is-ignored",
    config: {
      presets: ["pci-dss"],
      customPresets: { team: { email: { action: "mask" } } },
      rules: {},
    },
  },
  {
    id: "custom-preset/shadows-builtin-name",
    config: {
      presets: ["pii"],
      customPresets: { pii: { email: { action: "mask" } } },
      rules: {},
    },
  },
  {
    id: "override/explicit-action-wins",
    config: {
      presets: ["pci-dss"],
      rules: { payment_card: { action: "mask", preserve: { last: 4 } } },
    },
  },
  {
    id: "override/explicit-off-removes-preset-rule",
    config: { presets: ["pci-dss"], rules: { payment_card: "off" } },
  },
  {
    id: "override/explicit-adds-rule",
    config: { presets: ["pci-dss"], rules: { email: { action: "remove" } } },
  },
  {
    id: "override/restore-and-allowlist-do-not-affect-policy",
    config: {
      presets: ["pci-dss"],
      rules: {},
      restore: true,
      allowlist: ["example"],
    },
  },
];
