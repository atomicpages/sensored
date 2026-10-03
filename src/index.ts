import { builtInDetectors } from "./detectors/registry";
import {
  collectMatches,
  createRestorationContext,
  processText,
  renderMatches,
} from "./engine";
import { SensoredError } from "./errors";
import { resolvePolicy } from "./policy";
import { restore as restoreText } from "./restore";
import { JevProvider, type SemanticProvider } from "./semantic/provider";
import type {
  AsyncRedactResult,
  SemanticCandidate,
  SemanticDetection,
  SemanticResult,
} from "./semantic/types";
import { createStream } from "./stream";
import type {
  ContextHint,
  DetectorDescription,
  Inspection,
  RedactorConfig,
  RedactResult,
  RestorationMap,
  StreamEvent,
  StreamOptions,
} from "./types";

export { Detector } from "./detectors/base";
export { preloadPersonNameDetector } from "./detectors/person/person-name";
export { employeeIdExample } from "./employee-id";
export type { ErrorCode, ProblemDetails } from "./errors";
export { SensoredError } from "./errors";
export { restore } from "./restore";
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
export const MAX_INPUT_LENGTH = 1_048_576;

function describeDetector(detector: {
  readonly id: string;
  readonly entityType: string;
  readonly replacement: string;
  readonly stream?: unknown;
  readonly contextHint?: ContextHint;
}): DetectorDescription {
  return Object.freeze({
    id: detector.id,
    entityType: detector.entityType,
    replacement: detector.replacement,
    stream: detector.stream !== undefined,
    ...(detector.contextHint !== undefined
      ? { contextHint: detector.contextHint }
      : {}),
  });
}

export function listDetectors(): readonly DetectorDescription[] {
  const detectors = builtInDetectors();

  return Object.freeze(Array.from(detectors.values()).map(describeDetector));
}

interface RedactorBase {
  readonly policy: ReturnType<typeof resolvePolicy>["policy"];
  describe(): readonly DetectorDescription[];
  inspect(text: string): Inspection;
  redactAsync(text: string): Promise<AsyncRedactResult>;
  stream(
    chunks: AsyncIterable<string>,
    options?: StreamOptions,
  ): AsyncIterable<StreamEvent>;
  restore(text: string, map: RestorationMap): string;
}

interface RedactorWithoutRestore extends RedactorBase {
  redact(text: string): string;
}

interface RedactorWithRestore extends RedactorBase {
  redact(text: string): RedactResult;
}

export type Redactor = RedactorWithRestore | RedactorWithoutRestore;

export function createRedactor(
  config: RedactorConfig & { restore: true },
): RedactorWithRestore;
export function createRedactor(config: RedactorConfig): RedactorWithoutRestore;
export function createRedactor(config: RedactorConfig) {
  const {
    policy,
    rules,
    allowlist,
    semantic: semanticConfig,
    detectOnly,
  } = resolvePolicy(config);
  const limit = config.limits?.maxInputLength ?? MAX_INPUT_LENGTH;
  const restoreEnabled = config.restore ?? false;

  let cachedProvider: SemanticProvider | undefined;

  function getProvider(): SemanticProvider {
    if (cachedProvider) {
      return cachedProvider;
    }

    if (!semanticConfig) {
      throw new SensoredError("INVALID_CONFIG", "semantic");
    }

    cachedProvider = new JevProvider({
      apiKey: semanticConfig.apiKey,
      model: semanticConfig.model,
      thresholds: semanticConfig.thresholds,
    });

    return cachedProvider;
  }

  function process(text: string, report: boolean) {
    if (typeof text !== "string") {
      throw new SensoredError("INVALID_CONFIG", "input");
    }

    if (text.length > limit) {
      throw new SensoredError("INPUT_LIMIT");
    }

    return processText(
      text,
      rules,
      report,
      restoreEnabled,
      allowlist,
      detectOnly,
    );
  }

  async function processAsync(text: string): Promise<AsyncRedactResult> {
    if (typeof text !== "string") {
      throw new SensoredError("INVALID_CONFIG", "input");
    }

    if (text.length > limit) {
      throw new SensoredError("INPUT_LIMIT");
    }

    const allMatches = collectMatches(text, rules, allowlist);

    const contextWindow = semanticConfig?.contextWindow ?? 200;
    const candidates: SemanticCandidate[] = [];
    const candidateMatchIndices: number[] = [];

    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];

      if (!match) {
        continue;
      }

      const value = text.slice(match.detection.start, match.detection.end);

      const before = text.slice(
        Math.max(0, match.detection.start - contextWindow),
        match.detection.start,
      );

      const after = text.slice(
        match.detection.end,
        match.detection.end + contextWindow,
      );

      const question = match.rule.detector.semanticConfirm?.({
        value,
        before,
        after,
      });

      if (question) {
        candidates.push({
          ruleId: match.detection.ruleId,
          entityType: match.detection.entityType,
          value,
          before,
          after,
          question,
        });

        candidateMatchIndices.push(i);
      }
    }

    const restoration =
      restoreEnabled && !detectOnly ? createRestorationContext() : undefined;

    if (candidates.length === 0) {
      const { segments } = renderMatches(
        text,
        allMatches,
        text.length,
        false,
        0,
        restoration,
        detectOnly,
      );

      return {
        text: segments.map((s) => s.text).join(""),
        detections: allMatches.map((m) => ({
          ...m.detection,
          semanticConfirmed: true,
        })),
        ...(restoration
          ? {
              map: Object.freeze(Object.fromEntries(restoration.map.entries())),
            }
          : {}),
      };
    }

    const warnings: string[] = [];
    const matchIndexToResult = new Map<number, SemanticResult>();

    try {
      const provider = getProvider();
      const results = await provider.confirm(candidates);

      for (let i = 0; i < results.length; i++) {
        const matchIndex = candidateMatchIndices[i];
        const result = results[i];

        if (matchIndex !== undefined && result) {
          matchIndexToResult.set(matchIndex, result);
        }
      }
    } catch {
      warnings.push("Semantic confirmation failed; all detections retained.");
    }

    const confirmedIndices = new Set<number>();

    for (let i = 0; i < allMatches.length; i++) {
      const result = matchIndexToResult.get(i);

      if (!result || result.confirmed) {
        confirmedIndices.add(i);
      }
    }

    const confirmedMatches = allMatches.filter((_, i) =>
      confirmedIndices.has(i),
    );

    const { segments } = renderMatches(
      text,
      confirmedMatches,
      text.length,
      false,
      0,
      restoration,
      detectOnly,
    );

    const detections: SemanticDetection[] = [];

    for (let i = 0; i < allMatches.length; i++) {
      if (!confirmedIndices.has(i)) {
        continue;
      }

      const match = allMatches[i];

      if (!match) {
        continue;
      }

      const result = matchIndexToResult.get(i);

      detections.push({
        ...match.detection,
        semanticConfirmed: true,
        ...(result?.noul !== undefined ? { noul: result.noul } : {}),
      });
    }

    return {
      text: segments.map((s) => s.text).join(""),
      detections,
      ...(restoration
        ? {
            map: Object.freeze(Object.fromEntries(restoration.map.entries())),
          }
        : {}),
      ...(warnings.length > 0 ? { warnings: Object.freeze(warnings) } : {}),
    };
  }

  return Object.freeze({
    policy,
    describe(): readonly DetectorDescription[] {
      return Object.freeze(
        rules.map((rule) => describeDetector(rule.detector)),
      );
    },
    redact(text: string): string | RedactResult {
      const result = process(text, false);

      if (restoreEnabled && result.map) {
        return { text: result.text, map: result.map };
      }

      return result.text;
    },
    async redactAsync(text: string): Promise<AsyncRedactResult> {
      return processAsync(text);
    },
    inspect(text: string): Inspection {
      return process(text, true);
    },
    stream(
      chunks: AsyncIterable<string>,
      options?: StreamOptions,
    ): AsyncIterable<StreamEvent> {
      if (semanticConfig) {
        console.warn(
          "sensored: semantic confirmation config is ignored in streaming mode; detections are not semantically confirmed.",
        );
      }

      return createStream(rules, {
        restore: restoreEnabled,
        ...options,
        allowlist,
        detectOnly,
      })(chunks);
    },
    restore(text: string, map: RestorationMap): string {
      return restoreText(text, map);
    },
  });
}
