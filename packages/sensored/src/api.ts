import { listDetectors, restore } from "./native/calls";
import { createNativeRedactor } from "./native/redactor";
import type {
  RedactorWithoutRestore,
  RedactorWithRestore,
} from "./redactor-types";
import type { RedactorConfig } from "./types";

export { Detector } from "./detectors/base";
export { employeeIdExample } from "./employee-id";
export type { ErrorCode, ProblemDetails } from "./errors";
export { SensoredError } from "./errors";
export { MAX_INPUT_LENGTH } from "./limits";
export type { Redactor } from "./redactor-types";
export type {
  AsyncRedactResult,
  SemanticCandidate,
  SemanticDetection,
  SemanticQuestion,
  SemanticResult,
} from "./semantic/types";
export { redactValue } from "./traverse";
export type {
  ContextHint,
  Detection,
  DetectorDefinition,
  DetectorDescription,
  FormatPreserveRule,
  InspectedMatch,
  Inspection,
  InspectionGroup,
  MaskRule,
  RedactorConfig,
  RedactResult,
  RedactRule,
  RemoveRule,
  RestorationMap,
  RuleSetting,
  SemanticConfig,
  StreamEvent,
  StreamOptions,
  TokenReplaceRule,
} from "./types";
export { listDetectors, restore };

const PERSON_NAME_READY: Promise<void> = Promise.resolve();

/**
 * Kept for API compatibility: the Rust core's `person_name` needs no
 * preloading, so this resolves immediately (always the same promise).
 */
export function preloadPersonNameDetector(): Promise<void> {
  return PERSON_NAME_READY;
}

export function createRedactor(
  config: RedactorConfig & { restore: true },
): RedactorWithRestore;
export function createRedactor(config: RedactorConfig): RedactorWithoutRestore;
export function createRedactor(config: RedactorConfig) {
  return createNativeRedactor(config);
}
