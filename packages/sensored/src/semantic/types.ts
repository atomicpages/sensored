import type { Detection, RestorationMap } from "../types";

/** A yes/no question structure for Noul evaluation. */
export interface SemanticQuestion {
  readonly instructions: string | object;
  readonly criteria?: {
    readonly true: string;
    readonly false: string;
  };
}

/** A candidate detection submitted for semantic confirmation. */
export interface SemanticCandidate {
  readonly ruleId: string;
  readonly entityType: string;
  readonly value: string;
  readonly before: string;
  readonly after: string;
  readonly question: SemanticQuestion;
}

/** Result of a semantic confirmation check. */
export interface SemanticResult {
  readonly ruleId: string;
  readonly confirmed: boolean;
  readonly noul: number;
}

/** A detection augmented with semantic confirmation metadata. */
export interface SemanticDetection extends Detection {
  readonly semanticConfirmed: boolean;
  readonly noul?: number;
}

/** Return type of `redactAsync()`. */
export interface AsyncRedactResult {
  readonly text: string;
  readonly map?: RestorationMap;
  readonly detections: readonly SemanticDetection[];
  readonly warnings?: readonly string[];
}
