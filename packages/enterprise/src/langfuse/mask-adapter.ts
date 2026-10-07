import type { RedactorConfig } from "sensored";
import { createRedactor } from "sensored";

export function createLangfuseMaskFunction(
  config: RedactorConfig,
): (input: { data: string }) => string {
  const redactor = createRedactor(config);

  return (input: { data: string }): string => {
    return redactor.redact(input.data);
  };
}
