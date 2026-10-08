import { type Redactor, type RedactorConfig, redactValue } from "sensored";

export interface RedactionConfig {
  readonly redactorConfig: RedactorConfig;
  readonly includeAttributes?: readonly string[];
  readonly excludeAttributes?: readonly string[];
}

export function shouldRedactAttribute(
  key: string,
  config: RedactionConfig,
): boolean {
  if (config.includeAttributes !== undefined) {
    return config.includeAttributes.includes(key);
  }

  if (config.excludeAttributes !== undefined) {
    return !config.excludeAttributes.includes(key);
  }

  return true;
}

export function redactAttributes(
  attributes: Record<string, unknown>,
  config: RedactionConfig,
  redactor: Redactor,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(attributes)) {
    const value = attributes[key];

    if (!shouldRedactAttribute(key, config)) {
      result[key] = value;
      continue;
    }

    if (typeof value === "string") {
      const redacted = redactor.redact(value);
      result[key] = typeof redacted === "string" ? redacted : redacted.text;
    } else {
      result[key] = redactValue(value, redactor);
    }
  }

  return result;
}

/**
 * Shallow-clone an object while overriding specific properties.
 * Preserves the prototype chain for duck-typed OTEL span/log records.
 *
 * Exported from this module but not from the enterprise barrel — internal helper.
 */
export function cloneWithOverrides<T extends object>(
  obj: T,
  overrides: Record<string, unknown>,
): T {
  return Object.assign(
    Object.create(Object.getPrototypeOf(obj)) as T,
    obj,
    overrides,
  );
}
