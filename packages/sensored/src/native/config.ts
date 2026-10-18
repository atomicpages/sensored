import { MAX_INPUT_LENGTH } from "../limits";
import type { DetectorDefinition, SemanticConfig } from "../types";
import { validateConfig } from "../validate";

/** A `RedactorConfig` split into what the core reads and what stays in JS. */
export interface SplitConfig {
  /** The JSON-only config for `Redactor.create`. */
  readonly json: string;
  /** Run in JS; the core gets their descriptors. */
  readonly definitions: readonly DetectorDefinition[];
  /** `customHeaders` RegExps, run in JS as `http_auth_header` detections. */
  readonly headerPatterns: readonly RegExp[];
  readonly semantic: SemanticConfig | undefined;
  readonly restore: boolean;
  readonly limit: number;
}

/** The JSON-able half of a definition: everything but its functions and RegExp. */
function toDescriptor(definition: DetectorDefinition): Record<string, unknown> {
  const { id, entityType, replacement, context, stream, contextHint } =
    definition;

  return {
    id,
    entityType,
    replacement,
    ...(context !== undefined ? { context } : {}),
    ...(stream !== undefined ? { stream } : {}),
    ...(contextHint !== undefined ? { contextHint } : {}),
  };
}

/**
 * Validates what only JS can check (RegExps, functions, `semantic`) with the
 * TS validators, in `resolvePolicy`'s order, then hands the rest to the core.
 */
export function splitConfig(config: unknown): SplitConfig {
  validateConfig(config);

  const { semantic, detectors, detectorOptions, ...rest } = config;
  const headers = detectorOptions?.http_auth_header?.customHeaders ?? [];
  const headerNames = headers.filter((h): h is string => typeof h === "string");

  const json = JSON.stringify({
    ...rest,
    ...(detectors !== undefined
      ? { detectors: detectors.map(toDescriptor) }
      : {}),
    ...(headerNames.length > 0
      ? {
          detectorOptions: { http_auth_header: { customHeaders: headerNames } },
        }
      : {}),
  });

  return {
    json,
    definitions: detectors ?? [],
    headerPatterns: headers.filter((h): h is RegExp => h instanceof RegExp),
    semantic,
    restore: config.restore ?? false,
    limit: config.limits?.maxInputLength ?? MAX_INPUT_LENGTH,
  };
}
