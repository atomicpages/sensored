import { SensoredError } from "./errors";
import type {
  DetectorDefinition,
  DetectorOptions,
  RedactorConfig,
  RuleSetting,
} from "./types";
import { hasOnlyKeys, isNonNegativeInteger, isRecord } from "./utils";

function invalid(path: string): never {
  throw new SensoredError("INVALID_CONFIG", path);
}

// ---------------------------------------------------------------------------
// Rule-setting validation
// ---------------------------------------------------------------------------

/** Keys each action is permitted to carry — prevents silently ignored misconfig. */
function allowedKeysForAction(action: unknown): readonly string[] | null {
  if (action === "redact") {
    return ["action", "replacement", "priority"];
  }

  if (action === "format-preserve") {
    return ["action"];
  }

  if (action === "token-replace") {
    return ["action", "tokens"];
  }

  if (action === "mask") {
    return ["action", "preserve"];
  }

  if (action === "remove") {
    return ["action"];
  }

  return null;
}

function validateRedactSetting(value: Record<string, unknown>): void {
  const { replacement, priority } = value;

  if (replacement !== undefined && typeof replacement !== "string") {
    invalid("rules");
  }

  if (
    priority !== undefined &&
    (typeof priority !== "number" || !Number.isSafeInteger(priority))
  ) {
    invalid("rules");
  }
}

function validateMaskSetting(value: Record<string, unknown>): void {
  const { preserve } = value;

  if (preserve === undefined) {
    return;
  }

  if (!isRecord(preserve)) {
    invalid("rules");
  }

  if (!hasOnlyKeys(preserve, ["first", "last"])) {
    invalid("rules");
  }

  if (preserve.first !== undefined && !isNonNegativeInteger(preserve.first)) {
    invalid("rules");
  }

  if (preserve.last !== undefined && !isNonNegativeInteger(preserve.last)) {
    invalid("rules");
  }
}

function validateTokenReplaceSetting(value: Record<string, unknown>): void {
  const { tokens } = value;

  if (tokens === undefined) {
    return;
  }

  if (!isRecord(tokens)) {
    invalid("rules");
  }

  for (const [key, val] of Object.entries(tokens)) {
    if (typeof key !== "string" || key.length === 0) {
      invalid("rules");
    }

    if (typeof val !== "string") {
      invalid("rules");
    }
  }
}

export function validateSetting(value: unknown): asserts value is RuleSetting {
  if (!isRecord(value)) {
    invalid("rules");
  }

  const allowed = allowedKeysForAction(value.action);

  if (allowed === null || !hasOnlyKeys(value, allowed)) {
    invalid("rules");
  }

  if (value.action === "redact") {
    validateRedactSetting(value);
  }

  if (value.action === "token-replace") {
    validateTokenReplaceSetting(value);
  }

  if (value.action === "mask") {
    validateMaskSetting(value);
  }
}

// ---------------------------------------------------------------------------
// Detector-definition validation
// ---------------------------------------------------------------------------

const DETECTOR_KEYS = [
  "id",
  "entityType",
  "replacement",
  "pattern",
  "context",
  "stream",
  "validate",
  "contextHint",
  "semanticConfirm",
] as const;

const CONTEXT_KEYS = ["before", "after"] as const;

const STREAM_KEYS = [
  "maxMatchLength",
  "leftContext",
  "rightContext",
  "boundaryLookaround",
] as const;

function validateContext(context: unknown): asserts context is {
  before: number;
  after: number;
} {
  if (!isRecord(context)) {
    invalid("detectors.context");
  }

  if (!hasOnlyKeys(context, [...CONTEXT_KEYS])) {
    invalid("detectors.context");
  }

  if (!isNonNegativeInteger(context.before)) {
    invalid("detectors.context");
  }

  if (!isNonNegativeInteger(context.after)) {
    invalid("detectors.context");
  }
}

function validateStream(
  stream: unknown,
  context: { before: number; after: number } | undefined,
): asserts stream is {
  maxMatchLength: number;
  leftContext: number;
  rightContext: number;
  boundaryLookaround: number;
} {
  if (!isRecord(stream)) {
    invalid("detectors.stream");
  }

  if (!hasOnlyKeys(stream, [...STREAM_KEYS])) {
    invalid("detectors.stream");
  }

  if (!isNonNegativeInteger(stream.maxMatchLength)) {
    invalid("detectors.stream");
  }

  // A max match length of zero would reject every candidate.
  if (stream.maxMatchLength === 0) {
    invalid("detectors.stream");
  }

  if (!isNonNegativeInteger(stream.leftContext)) {
    invalid("detectors.stream");
  }

  if (!isNonNegativeInteger(stream.rightContext)) {
    invalid("detectors.stream");
  }

  if (!isNonNegativeInteger(stream.boundaryLookaround)) {
    invalid("detectors.stream");
  }

  // Context windows must fit inside the stream's declared lookaround budget.
  if (context) {
    if (context.before > stream.leftContext) {
      invalid("detectors.stream");
    }

    if (context.after > stream.rightContext) {
      invalid("detectors.stream");
    }
  }
}

const CONTEXT_HINT_KEYS = ["labels", "position", "instructions"] as const;

function validateContextHint(hint: unknown): void {
  if (!isRecord(hint)) {
    invalid("detectors.contextHint");
  }

  if (!hasOnlyKeys(hint, [...CONTEXT_HINT_KEYS])) {
    invalid("detectors.contextHint");
  }

  if (hint.labels !== undefined) {
    if (!Array.isArray(hint.labels) || hint.labels.length === 0) {
      invalid("detectors.contextHint");
    }

    for (const label of hint.labels) {
      if (typeof label !== "string" || label.length === 0) {
        invalid("detectors.contextHint");
      }
    }
  }

  if (
    hint.position !== undefined &&
    (typeof hint.position !== "string" ||
      !["preceding", "following", "both"].includes(hint.position))
  ) {
    invalid("detectors.contextHint");
  }

  if (
    hint.instructions !== undefined &&
    typeof hint.instructions !== "string"
  ) {
    invalid("detectors.contextHint");
  }
}

export function validateDefinition(
  value: unknown,
): asserts value is DetectorDefinition {
  if (!isRecord(value)) {
    invalid("detectors");
  }

  // id must be a lowercase snake-case identifier.
  if (typeof value.id !== "string" || !/^[a-z][a-z0-9_]*$/.test(value.id)) {
    invalid("detectors");
  }

  if (typeof value.entityType !== "string" || value.entityType.length === 0) {
    invalid("detectors");
  }

  if (typeof value.replacement !== "string") {
    invalid("detectors");
  }

  if (!(value.pattern instanceof RegExp)) {
    invalid("detectors");
  }

  if (value.validate !== undefined && typeof value.validate !== "function") {
    invalid("detectors");
  }

  if (
    value.semanticConfirm !== undefined &&
    typeof value.semanticConfirm !== "function"
  ) {
    invalid("detectors.semanticConfirm");
  }

  if (!hasOnlyKeys(value, [...DETECTOR_KEYS])) {
    invalid("detectors");
  }

  if (value.context !== undefined) {
    validateContext(value.context);
  }

  if (value.stream !== undefined) {
    validateStream(value.stream, value.context);
  }

  if (value.contextHint !== undefined) {
    validateContextHint(value.contextHint);
  }
}

// ---------------------------------------------------------------------------
// Semantic config validation
// ---------------------------------------------------------------------------

const SEMANTIC_KEYS = [
  "provider",
  "apiKey",
  "model",
  "thresholds",
  "contextWindow",
] as const;

function validateSemanticConfig(value: unknown): asserts value is {
  provider: "jev";
  apiKey: string;
  model?: string;
  thresholds?: Readonly<Record<string, number>>;
  contextWindow?: number;
} {
  if (!isRecord(value)) {
    invalid("semantic");
  }

  if (!hasOnlyKeys(value, [...SEMANTIC_KEYS])) {
    invalid("semantic");
  }

  if (value.provider !== "jev") {
    invalid("semantic.provider");
  }

  if (typeof value.apiKey !== "string" || value.apiKey.length === 0) {
    invalid("semantic.apiKey");
  }

  if (value.model !== undefined && typeof value.model !== "string") {
    invalid("semantic.model");
  }

  if (
    value.contextWindow !== undefined &&
    (!isNonNegativeInteger(value.contextWindow) || value.contextWindow === 0)
  ) {
    invalid("semantic.contextWindow");
  }

  if (value.thresholds !== undefined) {
    if (!isRecord(value.thresholds)) {
      invalid("semantic.thresholds");
    }

    for (const threshold of Object.values(value.thresholds)) {
      if (
        typeof threshold !== "number" ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > 1
      ) {
        invalid("semantic.thresholds");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Detector-options validation
// ---------------------------------------------------------------------------

const HTTP_AUTH_HEADER_OPTIONS_KEYS = ["customHeaders"] as const;

function validateDetectorOptions(
  value: unknown,
): asserts value is DetectorOptions {
  if (!isRecord(value)) {
    invalid("detectorOptions");
  }

  if (!hasOnlyKeys(value, ["http_auth_header"])) {
    invalid("detectorOptions");
  }

  if (value.http_auth_header !== undefined) {
    const hah = value.http_auth_header;

    if (!isRecord(hah)) {
      invalid("detectorOptions.http_auth_header");
    }

    if (!hasOnlyKeys(hah, [...HTTP_AUTH_HEADER_OPTIONS_KEYS])) {
      invalid("detectorOptions.http_auth_header");
    }

    if (hah.customHeaders !== undefined) {
      if (!Array.isArray(hah.customHeaders) || hah.customHeaders.length === 0) {
        invalid("detectorOptions.http_auth_header.customHeaders");
      }

      for (const header of hah.customHeaders) {
        if (typeof header !== "string" && !(header instanceof RegExp)) {
          invalid("detectorOptions.http_auth_header.customHeaders");
        }

        if (typeof header === "string" && header.length === 0) {
          invalid("detectorOptions.http_auth_header.customHeaders");
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Top-level config validation
// ---------------------------------------------------------------------------

const CONFIG_KEYS = [
  "presets",
  "customPresets",
  "rules",
  "limits",
  "detectors",
  "restore",
  "allowlist",
  "semantic",
  "detectOnly",
  "detectorOptions",
  "auditSink",
] as const;

export function validateConfigShape(
  config: unknown,
): asserts config is RedactorConfig {
  if (!isRecord(config)) {
    invalid("rules");
  }

  if (!hasOnlyKeys(config, [...CONFIG_KEYS])) {
    invalid("rules");
  }

  if (!isRecord(config.rules)) {
    invalid("rules");
  }

  if (config.presets !== undefined) {
    if (!Array.isArray(config.presets)) {
      invalid("presets");
    }

    for (const name of config.presets) {
      if (typeof name !== "string" || name.length === 0) {
        invalid("presets");
      }
    }
  }

  if (config.customPresets !== undefined) {
    if (!isRecord(config.customPresets)) {
      invalid("customPresets");
    }

    for (const [presetName, presetRules] of Object.entries(
      config.customPresets,
    )) {
      if (
        typeof presetName !== "string" ||
        presetName.length === 0 ||
        !/^[a-z][a-z0-9_-]*$/.test(presetName)
      ) {
        invalid("customPresets");
      }

      if (!isRecord(presetRules)) {
        invalid("customPresets");
      }

      for (const [ruleId, ruleValue] of Object.entries(presetRules)) {
        if (typeof ruleId !== "string" || ruleId.length === 0) {
          invalid("customPresets");
        }

        if (ruleValue === "off") {
          continue;
        }

        validateSetting(ruleValue);
      }
    }
  }

  if (config.restore !== undefined && typeof config.restore !== "boolean") {
    invalid("restore");
  }

  if (config.allowlist !== undefined) {
    if (!Array.isArray(config.allowlist)) {
      invalid("allowlist");
    }

    for (const item of config.allowlist) {
      if (typeof item !== "string" || item.length === 0) {
        invalid("allowlist");
      }
    }
  }

  if (config.semantic !== undefined) {
    validateSemanticConfig(config.semantic);
  }

  if (config.detectorOptions !== undefined) {
    validateDetectorOptions(config.detectorOptions);
  }

  if (config.auditSink !== undefined) {
    if (
      !isRecord(config.auditSink) ||
      typeof config.auditSink.write !== "function"
    ) {
      invalid("auditSink");
    }
  }
}

export function validateLimits(
  limits: unknown,
): asserts limits is { maxInputLength?: number } {
  if (!isRecord(limits)) {
    invalid("limits.maxInputLength");
  }

  if (!hasOnlyKeys(limits, ["maxInputLength"])) {
    invalid("limits.maxInputLength");
  }

  const { maxInputLength } = limits;

  if (maxInputLength === undefined) {
    return;
  }

  if (!isNonNegativeInteger(maxInputLength) || maxInputLength === 0) {
    invalid("limits.maxInputLength");
  }
}
