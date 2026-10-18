import type { AsyncRedactResult } from "./semantic/types";
import type {
  DetectorDescription,
  Inspection,
  RedactResult,
  RestorationMap,
  RuleSetting,
  StreamEvent,
  StreamOptions,
} from "./types";

/** The redactor shapes `createRedactor` returns, shared by both engines. */
export interface RedactorBase {
  readonly policy: Readonly<Record<string, RuleSetting>>;
  describe(): readonly DetectorDescription[];
  inspect(text: string): Inspection;
  redactAsync(text: string): Promise<AsyncRedactResult>;
  stream(
    chunks: AsyncIterable<string>,
    options?: StreamOptions,
  ): AsyncIterable<StreamEvent>;
  restore(text: string, map: RestorationMap): string;
}

export interface RedactorWithoutRestore extends RedactorBase {
  redact(text: string): string;
}

export interface RedactorWithRestore extends RedactorBase {
  redact(text: string): RedactResult;
}

export type Redactor = RedactorWithRestore | RedactorWithoutRestore;
