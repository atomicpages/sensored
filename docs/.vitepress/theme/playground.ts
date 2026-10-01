export const PLAYGROUND_INPUT_LIMIT = 50_000;

export const PLAYGROUND_PRESETS = [
  "pii",
  "gdpr",
  "hipaa",
  "ccpa",
  "pci-dss",
  "healthcare",
  "finance",
  "education",
  "soc2",
  "security",
] as const;

export const PLAYGROUND_ACTIONS = [
  "redact",
  "mask",
  "remove",
  "format-preserve",
  "token-replace",
] as const;

export type PlaygroundPreset = (typeof PLAYGROUND_PRESETS)[number];
export type PlaygroundAction = (typeof PLAYGROUND_ACTIONS)[number];

export const PLAYGROUND_TEMPLATES = Object.freeze({
  pii: `Customer: Dr. Maya Chen.
Email: maya.chen@example.com
Phone: +1 415-555-0136
Card: 4242 4242 4242 4242
IP: 203.0.113.42
Authorization: Bearer ghp_1234567890abcdefghijklmnopqrstuvwxyz
SSN: 078-05-1120`,
  gdpr: `Data subject: Elena Fischer
Email: elena.fischer@example.eu
Phone: +49 30 901820
IBAN: DE89370400440532013000
Address: 12 Friedrichstrasse, 10117 Berlin`,
  hipaa: `Patient: Jordan Lee
MRN: 12345678
Email: jordan.lee@example.com
Phone: +1 617-555-0142
SSN: 078-05-1120
Health Insurance ID: ABC123456789`,
  ccpa: `California consumer: Sofia Ramirez
Email: sofia.ramirez@example.com
Phone: +1 310-555-0175
Address: 123 Market Street, San Francisco, CA 94105
Device IMEI: 490154203237518`,
  "pci-dss": `Cardholder: Alex Morgan
Card number: 4242 4242 4242 4242
CVV: 123
Payment token: tok_123456789012345678901234
Transaction ID: TXN-ID 12345678`,
  healthcare: `Patient: Priya Shah
Medical Record Number: 87654321
NPI: 1234567893
Diagnosis code: A00
Clinical trial participant ID: AB1234
Email: priya.shah@example.com`,
  finance: `Account holder: Marcus Green
IBAN: GB82WEST12345698765432
SWIFT/BIC: DEUTDEFF
Routing number: 021000021
Card: 4242 4242 4242 4242
Transaction ID: TXN-ID 87654321`,
  education: `Student: Taylor Brooks
Email: taylor.brooks@example.edu
Phone: +1 202-555-0186
SSN: 078-05-1120
Passport: 123456789`,
  soc2: `Incident owner: Morgan Chen
Email: morgan.chen@example.com
Source IP: 203.0.113.42
AWS access key: AKIAIOSFODNN7EXAMPLE
GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwxyz
Card: 4242 4242 4242 4242`,
  security: `Source IP: 203.0.113.42
MAC address: 00:1A:2B:3C:4D:5E
AWS access key: AKIAIOSFODNN7EXAMPLE
GitHub token: ghp_1234567890abcdefghijklmnopqrstuvwxyz
API key: sk_test_1234567890abcdefghijklmnop`,
} satisfies Readonly<Record<PlaygroundPreset, string>>);

export interface PlaygroundState {
  readonly input: string;
  readonly preset: PlaygroundPreset;
  readonly action: PlaygroundAction;
  readonly allowlist: readonly string[];
  readonly disabledDetectors: ReadonlySet<string>;
  readonly nerEnabled: boolean;
}

export interface PlaygroundHandoff {
  readonly input: string;
  readonly preset: PlaygroundPreset;
  readonly action: PlaygroundAction;
}

export interface MatchDetail {
  readonly entityType: string;
  readonly ruleId: string;
  readonly start: number;
  readonly end: number;
  readonly reason: string;
  readonly preview: string;
}

type PlaygroundRule =
  | { readonly action: "redact"; readonly priority?: number }
  | { readonly action: Exclude<PlaygroundAction, "redact"> };

export const PLAYGROUND_SAMPLE = PLAYGROUND_TEMPLATES.pii;

export const PLAYGROUND_SAMPLE_OUTPUT = `Customer: [PERSON_NAME].
Email: [EMAIL]
Phone: [REDACTED]
Card: [REDACTED]
IP: 203.0.113.42
Authorization: Bearer ghp_1234567890abcdefghijklmnopqrstuvwxyz
SSN: [REDACTED]`;

export function createPlaygroundState(
  handoff?: PlaygroundHandoff,
): PlaygroundState {
  return {
    input: handoff?.input ?? PLAYGROUND_SAMPLE,
    preset: handoff?.preset ?? "pii",
    action: handoff?.action ?? "redact",
    allowlist: [],
    disabledDetectors: new Set(),
    nerEnabled: false,
  };
}

export function changePreset(
  state: PlaygroundState,
  preset: PlaygroundPreset,
  inputChanged = false,
): PlaygroundState {
  return {
    ...state,
    input: inputChanged ? state.input : PLAYGROUND_TEMPLATES[preset],
    preset,
    disabledDetectors: new Set(),
    nerEnabled: false,
  };
}

export function parseAllowlist(value: string): readonly string[] {
  const entries = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Object.freeze(Array.from(new Set(entries)));
}

export function buildPlaygroundRules(
  activeDetectorIds: readonly string[],
  state: PlaygroundState,
  priorities: Readonly<Record<string, number | undefined>> = {},
): Readonly<Record<string, PlaygroundRule | "off">> {
  const rules: Record<string, PlaygroundRule | "off"> = {};

  for (const detectorId of activeDetectorIds) {
    rules[detectorId] = state.disabledDetectors.has(detectorId)
      ? "off"
      : createRule(state.action, priorities[detectorId]);
  }

  if (state.nerEnabled) {
    rules.person_name_lite = "off";
    rules.person_name = createRule(state.action);
  }

  return Object.freeze(rules);
}

export function createMatchDetails(
  groups: readonly {
    readonly matches: readonly {
      readonly entityType: string;
      readonly ruleId: string;
      readonly start: number;
      readonly end: number;
      readonly reasons: readonly string[];
      readonly value: string;
    }[];
  }[],
): readonly MatchDetail[] {
  return Object.freeze(
    groups.flatMap((group) =>
      group.matches.map((match) => ({
        entityType: match.entityType,
        ruleId: match.ruleId,
        start: match.start,
        end: match.end,
        reason: match.reasons.join(", "),
        preview: maskMatch(match.value),
      })),
    ),
  );
}

export function summarizeEntities(
  details: readonly MatchDetail[],
): readonly string[] {
  return Object.freeze(
    Array.from(new Set(details.map((detail) => detail.entityType))).sort(),
  );
}

export function validatePlaygroundInput(input: string): string | undefined {
  if (input.length > PLAYGROUND_INPUT_LIMIT) {
    return `Input exceeds the ${PLAYGROUND_INPUT_LIMIT.toLocaleString()} character playground limit.`;
  }

  return undefined;
}

export function generatePlaygroundCode(
  activeDetectorIds: readonly string[],
  state: PlaygroundState,
  priorities: Readonly<Record<string, number | undefined>> = {},
): string {
  const rules = buildPlaygroundRules(activeDetectorIds, state, priorities);

  const imports = state.nerEnabled
    ? 'import { createRedactor, preloadPersonNameDetector } from "sensored";'
    : 'import { createRedactor } from "sensored";';

  const preload = state.nerEnabled
    ? "\n\nawait preloadPersonNameDetector();"
    : "";

  const allowlist =
    state.allowlist.length > 0
      ? `,\n  allowlist: ${JSON.stringify(state.allowlist)}`
      : "";

  return `${imports}${preload}

const redactor = createRedactor({
  presets: [${JSON.stringify(state.preset)}],
  rules: ${JSON.stringify(rules, null, 2).replaceAll("\n", "\n  ")}${allowlist},
});

const result = redactor.redact(${JSON.stringify(state.input)});
`;
}

function maskMatch(value: string): string {
  const visibleLength = Math.min(Array.from(value).length, 12);

  return "•".repeat(Math.max(visibleLength, 1));
}

function createRule(
  action: PlaygroundAction,
  priority?: number,
): PlaygroundRule {
  if (action === "redact") {
    return priority === undefined ? { action } : { action, priority };
  }

  return { action };
}
