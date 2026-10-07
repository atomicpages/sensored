import type { RedactorConfig } from "sensored";
import { createRedactor } from "sensored";

export function createLangfuseMaskFunction(
  config: RedactorConfig,
): (input: string) => string {
  const redactor = createRedactor(config);

  return (input: string): string => {
    return redactor.redact(input);
  };
}
