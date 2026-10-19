import type { SemanticQuestion } from "./types";

export interface SemanticCandidateText {
  readonly value: string;
  readonly before: string;
  readonly after: string;
}

export type QuestionBuilder = (
  candidate: SemanticCandidateText,
) => SemanticQuestion | undefined;

export function personNameQuestion(
  candidate: SemanticCandidateText,
): SemanticQuestion {
  return {
    instructions: {
      task: "Determine whether the candidate text refers to a specific individual person.",
      candidate: candidate.value,
      before: candidate.before,
      after: candidate.after,
    },
    criteria: {
      true: "The candidate is the name of a specific individual person (e.g. 'John Smith', 'Dr. Jane Doe').",
      false:
        "The candidate is a place, organization, product, title, or sentence-start word (e.g. 'New York', 'Apple Inc').",
    },
  };
}

/**
 * `semanticConfirm` of the built-in detectors that opt in, keyed by rule id.
 * The Rust core runs the detectors; their questions stay in JS.
 */
const BUILTIN_QUESTIONS: Readonly<Record<string, QuestionBuilder>> = {
  person_name_lite: personNameQuestion,
};

export function builtinQuestion(ruleId: string): QuestionBuilder | undefined {
  return Object.hasOwn(BUILTIN_QUESTIONS, ruleId)
    ? BUILTIN_QUESTIONS[ruleId]
    : undefined;
}
