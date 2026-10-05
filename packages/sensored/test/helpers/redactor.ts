import type { Detector } from "../../src/detectors/base";
import { createRedactor } from "../../src/index";
import type {
  RedactorConfig,
  RedactResult,
  RestorationMap,
  RuleSetting,
} from "../../src/types";

type Redactor = ReturnType<typeof createRedactor>;

interface RedactorWithoutRestore {
  readonly policy: Readonly<Record<string, RuleSetting>>;
  redact(text: string): string;
  inspect(
    text: string,
  ): Redactor["inspect"] extends (text: string) => infer I ? I : never;
  stream: Redactor["stream"];
  restore(text: string, map: RestorationMap): string;
}

interface RedactorWithRestore {
  readonly policy: Readonly<Record<string, RuleSetting>>;
  redact(text: string): RedactResult;
  inspect(
    text: string,
  ): Redactor["inspect"] extends (text: string) => infer I ? I : never;
  stream: Redactor["stream"];
  restore(text: string, map: RestorationMap): string;
}

export function makeRedactor(
  entries: readonly {
    readonly detector: Detector;
    readonly setting: RuleSetting;
  }[],
): RedactorWithoutRestore;

export function makeRedactor(
  entries: readonly {
    readonly detector: Detector;
    readonly setting: RuleSetting;
  }[],
  restore: true,
): RedactorWithRestore;

export function makeRedactor(
  entries: readonly {
    readonly detector: Detector;
    readonly setting: RuleSetting;
  }[],
  restoreEnabled = false,
): RedactorWithoutRestore | RedactorWithRestore {
  const rules: Record<string, RuleSetting> = {};

  for (const { detector, setting } of entries) {
    rules[detector.id] = setting;
  }

  const config: RedactorConfig = {
    rules,
    restore: restoreEnabled ? true : undefined,
  };

  return createRedactor(config) as RedactorWithoutRestore | RedactorWithRestore;
}
