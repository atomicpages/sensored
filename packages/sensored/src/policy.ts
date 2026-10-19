import { registerDetector } from "./detectors/base";
import { builtInDetectors } from "./detectors/registry";
import {
  buildHttpAuthHeaderPattern,
  HttpAuthHeaderDetector,
} from "./detectors/token/http-auth-header";
import { SensoredError } from "./errors";
import { BUILTIN_PRESETS } from "./presets";
import type { ActiveRule, RuleSetting, SemanticConfig } from "./types";
import { validateConfig, validateSetting } from "./validate";

// ---------------------------------------------------------------------------
// Setting snapshots
// ---------------------------------------------------------------------------

/** Deep-freeze a rule setting so callers can't mutate it after registration. */
function freezeSetting(value: RuleSetting): RuleSetting {
  if (value.action === "mask" && value.preserve) {
    return Object.freeze({
      ...value,
      preserve: Object.freeze({ ...value.preserve }),
    });
  }

  if (value.action === "token-replace" && value.tokens) {
    return Object.freeze({
      ...value,
      tokens: Object.freeze({ ...value.tokens }),
    });
  }

  return Object.freeze({ ...value });
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

/**
 * Parse a preset reference into name and optional version.
 * `pii` → { name: "pii", version: undefined }
 * `pii@1` → { name: "pii", version: 1 }
 *
 * Note: All built-in presets are flat (single version). The @N syntax
 * remains supported for compatibility but all presets have only v1.
 */
function parsePresetRef(ref: string): {
  name: string;
  version: number | undefined;
} {
  const atIndex = ref.lastIndexOf("@");

  if (atIndex === -1) {
    return { name: ref, version: undefined };
  }

  const name = ref.slice(0, atIndex);
  const versionStr = ref.slice(atIndex + 1);

  if (name.length === 0 || !/^[a-z][a-z0-9_-]*$/.test(name)) {
    throw new SensoredError("UNKNOWN_RULE", "presets");
  }

  const version = Number.parseInt(versionStr, 10);

  if (
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !/^\d+$/.test(versionStr)
  ) {
    throw new SensoredError("UNKNOWN_RULE", "presets");
  }

  return { name, version };
}

// ---------------------------------------------------------------------------
// Preset expansion
// ---------------------------------------------------------------------------

/**
 * Merge one preset's rules. Conflicting actions throw, unless the config sets
 * that rule explicitly: the explicit rule wins anyway, so the conflict is moot.
 */
function mergePresetRules(
  merged: Record<string, RuleSetting>,
  presetRules: Readonly<Record<string, RuleSetting | "off">>,
  explicit: ReadonlySet<string>,
): void {
  for (const [ruleId, ruleValue] of Object.entries(presetRules)) {
    if (ruleValue === "off") {
      continue;
    }

    const existing = merged[ruleId];

    if (
      existing !== undefined &&
      existing.action !== ruleValue.action &&
      !explicit.has(ruleId)
    ) {
      throw new SensoredError("POLICY_CONFLICT", "presets");
    }

    merged[ruleId] = ruleValue;
  }
}

function resolvePresets(
  presetNames: readonly string[],
  customPresets:
    | Readonly<Record<string, Readonly<Record<string, RuleSetting | "off">>>>
    | undefined,
  explicit: ReadonlySet<string>,
): Record<string, RuleSetting> {
  const merged: Record<string, RuleSetting> = Object.create(null);

  for (const ref of presetNames) {
    const { name, version } = parsePresetRef(ref);

    const customPreset =
      customPresets && Object.hasOwn(customPresets, name)
        ? customPresets[name]
        : undefined;

    if (customPreset !== undefined) {
      if (version !== undefined) {
        throw new SensoredError("UNKNOWN_RULE", "presets", {
          preset: name,
          reason: "custom_presets_do_not_support_versioning",
        });
      }

      mergePresetRules(merged, customPreset, explicit);
      continue;
    }

    const versions = Object.hasOwn(BUILTIN_PRESETS, name)
      ? BUILTIN_PRESETS[name]
      : undefined;

    if (versions === undefined) {
      throw new SensoredError("UNKNOWN_RULE", "presets");
    }

    const availableVersions = versions.map((_, i) => i + 1);

    if (version === undefined) {
      for (const delta of versions) {
        mergePresetRules(merged, delta, explicit);
      }
    } else {
      const index = version - 1;

      if (index < 0 || index >= versions.length) {
        throw new SensoredError("UNKNOWN_RULE", "presets", {
          preset: name,
          availableVersions,
        });
      }

      for (let i = 0; i <= index; i++) {
        const delta = versions[i];

        if (delta === undefined) {
          throw new SensoredError("UNKNOWN_RULE", "presets", {
            preset: name,
            availableVersions,
          });
        }

        mergePresetRules(merged, delta, explicit);
      }
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

export function resolvePolicy(config: unknown): {
  policy: Readonly<Record<string, RuleSetting>>;
  rules: ActiveRule[];
  allowlist: Set<string>;
  semantic: SemanticConfig | undefined;
  detectOnly: boolean;
} {
  validateConfig(config);

  const detectOnly = config.detectOnly ?? false;

  // Start with built-ins, then register custom detectors on top.
  const detectors = builtInDetectors();

  // Apply detector options — currently only http_auth_header supports
  // custom configuration (extra header patterns).
  if (config.detectorOptions?.http_auth_header?.customHeaders) {
    const customHeaders = config.detectorOptions.http_auth_header.customHeaders;
    const pattern = buildHttpAuthHeaderPattern(customHeaders);
    detectors.set("http_auth_header", new HttpAuthHeaderDetector(pattern));
  }

  for (const definition of config.detectors ?? []) {
    if (detectors.has(definition.id)) {
      throw new SensoredError("INVALID_CONFIG", "detectors");
    }

    detectors.set(definition.id, registerDetector(definition));
  }

  // Expand presets into a merged rule map, then apply explicit overrides.
  // Prototype-free maps, so rule ids like `__proto__` or `constructor` are
  // ordinary keys. Plain objects keep JS key order, which the Rust core mirrors.
  const presetRules: Record<string, RuleSetting> = Object.create(null);

  if (config.presets !== undefined) {
    Object.assign(
      presetRules,
      resolvePresets(
        config.presets,
        config.customPresets,
        new Set(Object.keys(config.rules)),
      ),
    );
  }

  // Apply explicit rules on top of presets — explicit always wins.
  const effectiveRules: Record<string, RuleSetting | "off"> = Object.assign(
    Object.create(null),
    presetRules,
  );

  for (const [id, value] of Object.entries(config.rules)) {
    effectiveRules[id] = value;
  }

  // Resolve each rule entry: skip "off", validate, freeze, and collect.
  const entries: [string, RuleSetting][] = [];
  const rules: ActiveRule[] = [];

  for (const [id, value] of Object.entries(effectiveRules)) {
    const detector = detectors.get(id);

    if (!detector) {
      throw new SensoredError("UNKNOWN_RULE", "rules");
    }

    if (value === "off") {
      continue;
    }

    validateSetting(value);

    const setting = freezeSetting(value);

    entries.push([id, setting]);
    rules.push({ detector, setting });
  }

  // An empty policy means nothing gets redacted — reject early.
  if (rules.length === 0) {
    throw new SensoredError("EMPTY_POLICY", "rules");
  }

  const allowlist = new Set<string>(config.allowlist ?? []);

  return {
    policy: Object.freeze(Object.fromEntries(entries)),
    rules,
    allowlist,
    semantic: config.semantic,
    detectOnly,
  };
}
