import { BUILTIN_PRESETS } from "../../packages/sensored/src/presets";
import type { RenderSeed } from "../reference";
import {
  BASIC_AUTH,
  CARD,
  EMAIL,
  IBAN,
  IPV4,
  IPV6,
  MAC,
  PHONE,
  SSN,
} from "./values";

/** One document touching the entity types the built-in presets cover. */
export const PRESET_TEXT = [
  `Patient Dr. Jane Smith (${EMAIL}, ${PHONE}) paid with card ${CARD}.`,
  `SSN: ${SSN}. IBAN ${IBAN}. NPI 1234567893.`,
  `Server ${IPV4} / ${IPV6}, MAC ${MAC}.`,
  BASIC_AUTH,
  "Callback https://user:pass@example.com/?api_key=example-value",
].join("\n");

export const PRESET_NAMES: readonly string[] = Object.keys(BUILTIN_PRESETS);

export const presetSeeds: readonly RenderSeed[] = [
  ...PRESET_NAMES.map((name) => ({
    id: `preset/${name}`,
    config: { presets: [name], rules: {} },
    input: PRESET_TEXT,
  })),
  {
    id: "preset-versioned/pii@1",
    config: { presets: ["pii@1"], rules: {} },
    input: PRESET_TEXT,
  },
  {
    id: "preset-combined/pci-dss+security",
    config: { presets: ["pci-dss", "security"], rules: {} },
    input: PRESET_TEXT,
  },
  {
    id: "preset-override/pii-email-mask-ipv4-off",
    config: {
      presets: ["pii", "security"],
      rules: { email: { action: "mask" }, ipv4: "off" },
    },
    input: PRESET_TEXT,
  },
];
