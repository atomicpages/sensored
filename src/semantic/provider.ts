import type { EntryType, NoulQuestion } from "@typesafe-ai/sdk";
import type { SemanticCandidate, SemanticResult } from "./types";

// ---------------------------------------------------------------------------
// SemanticProvider interface
// ---------------------------------------------------------------------------

export interface SemanticProvider {
  confirm(
    candidates: readonly SemanticCandidate[],
  ): Promise<readonly SemanticResult[]>;
}

// ---------------------------------------------------------------------------
// JevProvider — uses @typesafe-ai/sdk (dynamic import)
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "jev-latest";
const DEFAULT_THRESHOLD = 0.5;

export class JevProvider implements SemanticProvider {
  readonly #apiKey: string;
  readonly #model: string;
  readonly #thresholds: Readonly<Record<string, number>>;

  constructor(options: {
    readonly apiKey: string;
    readonly model?: string;
    readonly thresholds?: Readonly<Record<string, number>>;
  }) {
    this.#apiKey = options.apiKey;
    this.#model = options.model ?? DEFAULT_MODEL;
    this.#thresholds = options.thresholds ?? {};
  }

  async confirm(
    candidates: readonly SemanticCandidate[],
  ): Promise<readonly SemanticResult[]> {
    const sdk = await import("@typesafe-ai/sdk");

    const client = new sdk.TypeSafeClient({
      apiKey: this.#apiKey,
      defaultModel: this.#model,
    });

    const questions: Record<string, NoulQuestion> = {};

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      if (!candidate) {
        continue;
      }

      const { instructions, criteria } = candidate.question;

      const questionInstructions =
        typeof instructions === "string"
          ? { task: instructions, candidate: candidate.value }
          : instructions;

      questions[`q${i}`] = sdk.noul(
        questionInstructions as EntryType,
        criteria
          ? {
              true: criteria.true as EntryType,
              false: criteria.false as EntryType,
            }
          : undefined,
      );
    }

    const response = await client.systemOne({
      state: null,
      questions,
    });

    const results: SemanticResult[] = candidates.map((candidate, index) => {
      const answer = response.answers[`q${index}`];

      const noulValue = answer && answer.type === "noul" ? answer.noul : 1;

      const threshold =
        this.#thresholds[candidate.ruleId] ??
        this.#thresholds.default ??
        DEFAULT_THRESHOLD;

      return {
        ruleId: candidate.ruleId,
        confirmed: noulValue >= threshold,
        noul: noulValue,
      };
    });

    return results;
  }
}

// ---------------------------------------------------------------------------
// MockProvider — for testing, no network calls
// ---------------------------------------------------------------------------

export class MockProvider implements SemanticProvider {
  readonly #results: Readonly<Record<string, SemanticResult>>;

  constructor(results?: Readonly<Record<string, SemanticResult>>) {
    this.#results = results ?? {};
  }

  async confirm(
    candidates: readonly SemanticCandidate[],
  ): Promise<readonly SemanticResult[]> {
    return candidates.map((candidate) => {
      const preset = this.#results[candidate.ruleId];

      if (preset) {
        return preset;
      }

      return {
        ruleId: candidate.ruleId,
        confirmed: true,
        noul: 1,
      };
    });
  }
}
