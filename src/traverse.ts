import type { RedactResult } from "./types";

interface StringRedactor {
  redact(text: string): string | RedactResult;
}

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "auth",
  "cookie",
  "api_key",
  "apikey",
  "api_secret",
  "credential",
  "credentials",
  "private_key",
  "access_token",
  "refresh_token",
  "session",
  "session_id",
]);

export function redactValue<T>(input: T, redactor: StringRedactor): T {
  const visited = new WeakSet<object>();

  function redactString(s: string): string {
    const result = redactor.redact(s);
    return typeof result === "string" ? result : result.text;
  }

  function traverse<U>(value: U): U {
    if (value === null || value === undefined) {
      return value;
    }

    const type = typeof value;

    if (type === "string") {
      return redactString(value as string) as U;
    }

    if (type !== "object") {
      return value;
    }

    if (value instanceof Date || value instanceof RegExp) {
      return value;
    }

    if (visited.has(value as object)) {
      return value;
    }
    visited.add(value as object);

    if (value instanceof Error) {
      const cloned = new (value.constructor as ErrorConstructor)(
        redactString(value.message),
      );
      if (value.stack !== undefined) {
        cloned.stack = value.stack;
      }
      return cloned as U;
    }

    if (value instanceof URL) {
      return new URL(redactString(value.toString())) as U;
    }

    if (value instanceof URLSearchParams) {
      const params = new URLSearchParams();
      for (const [key, val] of value.entries()) {
        params.append(key, redactString(val));
      }
      return params as U;
    }

    if (value instanceof Map) {
      const map = new Map();
      for (const [key, val] of value.entries()) {
        const redactedKey = typeof key === "string" ? redactString(key) : key;
        map.set(redactedKey, traverse(val));
      }
      return map as U;
    }

    if (value instanceof Set) {
      const set = new Set();
      for (const entry of value) {
        if (typeof entry === "string") {
          set.add(redactString(entry));
        } else {
          set.add(traverse(entry));
        }
      }
      return set as U;
    }

    if (Array.isArray(value)) {
      return value.map(traverse) as U;
    }

    const obj: Record<PropertyKey, unknown> = {};
    for (const key of Reflect.ownKeys(value as object)) {
      const childValue = (value as Record<PropertyKey, unknown>)[key];
      const lowerKey = typeof key === "string" ? key.toLowerCase() : "";

      if (SENSITIVE_FIELDS.has(lowerKey)) {
        if (typeof childValue === "string") {
          const redacted = redactString(childValue);
          obj[key] = redacted === childValue ? "[REDACTED]" : redacted;
        } else if (childValue === null || childValue === undefined) {
          obj[key] = childValue;
        } else {
          obj[key] = "[REDACTED]";
        }
      } else {
        obj[key] = traverse(childValue);
      }
    }
    return obj as U;
  }

  return traverse(input);
}
