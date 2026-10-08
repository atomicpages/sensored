import {
  createRedactor,
  type Redactor,
  type RedactorConfig,
  type RedactResult,
  redactValue,
} from "sensored";

function makeRedactor(config: RedactorConfig): Redactor {
  return createRedactor(config);
}

export function createLangfuseMaskFunction(
  config: RedactorConfig,
): (input: { data: unknown }) => string {
  const redactor = makeRedactor(config);

  return (input: { data: unknown }): string => {
    if (typeof input.data === "string") {
      const result: string | RedactResult = redactor.redact(input.data);
      return typeof result === "string" ? result : result.text;
    }

    const redacted = redactValue(input.data, redactor);
    return JSON.stringify(redacted);
  };
}
