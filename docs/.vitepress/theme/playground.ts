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

export const PLAYGROUND_SAMPLE = `Customer: Dr. Maya Chen.
Email: maya.chen@example.com
Phone: +1 415-555-0136
Card: 4242 4242 4242 4242
IP: 203.0.113.42
Authorization: Bearer ghp_1234567890abcdefghijklmnopqrstuvwxyz
SSN: 078-05-1120`;

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
): PlaygroundState {
  return {
    ...state,
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
