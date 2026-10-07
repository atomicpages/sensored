import { createRedactor, type RedactorConfig, redactValue } from "sensored";

export function createLangfuseMaskFunction(
  config: RedactorConfig,
): (input: { data: unknown }) => string {
  const redactor = createRedactor(config);

  return (input: { data: unknown }): string => {
    if (typeof input.data === "string") {
      const result = redactor.redact(input.data);
      return typeof result === "string" ? result : result.text;
    }

    const redacted = redactValue(input.data, redactor);
    return JSON.stringify(redacted);
  };
}
