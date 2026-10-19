import { type Detector, registerDetector } from "../detectors/base";
import { SensoredError } from "../errors";
import { JevProvider, type SemanticProvider } from "../semantic/provider";
import { builtinQuestion, type QuestionBuilder } from "../semantic/questions";
import type {
  AsyncRedactResult,
  SemanticCandidate,
  SemanticDetection,
  SemanticResult,
} from "../semantic/types";
import { createStream, type StreamCore } from "../stream";
import type {
  DetectorDescription,
  Inspection,
  RedactResult,
  RestorationMap,
  RuleSetting,
  StreamEvent,
  StreamOptions,
} from "../types";
import { deepFreeze } from "../utils";
import {
  getBinding,
  type NativeDetection,
  type NativeInspection,
  type NativeStreamEvent,
} from "./binding";
import { engineCall, restore } from "./calls";
import { type SplitConfig, splitConfig } from "./config";
import { HeaderPatternDetector } from "./custom-headers";

/** The enabled rules whose detectors run in JS, in policy order. */
function jsDetectors(
  split: SplitConfig,
  policy: Readonly<Record<string, RuleSetting>>,
): Detector[] {
  const detectors = split.definitions
    .filter((definition) => Object.hasOwn(policy, definition.id))
    .map(registerDetector);

  if (
    split.headerPatterns.length > 0 &&
    Object.hasOwn(policy, "http_auth_header")
  ) {
    detectors.push(new HeaderPatternDetector(split.headerPatterns));
  }

  return detectors;
}

function freezeMap(map: Record<string, string>): RestorationMap {
  return Object.freeze(map);
}

function endsWithHighSurrogate(text: string): boolean {
  const last = text.charCodeAt(text.length - 1);

  return last >= 0xd800 && last <= 0xdbff;
}

function toStreamEvent(event: NativeStreamEvent): StreamEvent {
  if (event.type === "complete" && event.map !== undefined) {
    return { type: "complete", map: freezeMap(event.map) };
  }

  return event;
}

/**
 * `createRedactor` over the engine binding. With no JS rules every call is
 * one FFI call; otherwise JS detections join the core's through the hybrid
 * seam (`collect` + JS + `render`, `pushWith`/`finishWith` for streams).
 * `redactAsync` always takes the seam, so it can confirm matches first.
 */
export function createNativeRedactor(config: unknown) {
  const split = splitConfig(config);
  const core = engineCall(() => getBinding().Redactor.create(split.json));

  const policy: Readonly<Record<string, RuleSetting>> = deepFreeze(
    JSON.parse(core.policyJson()),
  );
  const descriptions: readonly DetectorDescription[] = deepFreeze(
    JSON.parse(core.describeJson()),
  );

  const detectors = jsDetectors(split, policy);
  /** No JS detectors: every call is one engine call, with no JS seam. */
  const coreOnly = detectors.length === 0;
  const streamable = descriptions.every((description) => description.stream);
  const ruleOrder = new Map(descriptions.map(({ id }, index) => [id, index]));

  const detectorsById = new Map(detectors.map((d) => [d.id, d]));

  // Results cross the boundary as JSON: one string costs far less than an
  // engine-built object per group and match.
  function inspectCore(text: string): NativeInspection {
    return JSON.parse(core.inspectJson(text));
  }

  function renderCore(
    text: string,
    detections: NativeDetection[],
    report: boolean,
  ): NativeInspection {
    return JSON.parse(core.renderJson(text, detections, report));
  }

  let cachedProvider: SemanticProvider | undefined;

  function getProvider(): SemanticProvider {
    if (cachedProvider) {
      return cachedProvider;
    }

    if (!split.semantic) {
      throw new SensoredError("INVALID_CONFIG", "semantic");
    }

    cachedProvider = new JevProvider({
      apiKey: split.semantic.apiKey,
      model: split.semantic.model,
      thresholds: split.semantic.thresholds,
    });

    return cachedProvider;
  }

  function checkInput(text: unknown): asserts text is string {
    if (typeof text !== "string") {
      throw new SensoredError("INVALID_CONFIG", "input");
    }

    if (text.length > split.limit) {
      throw new SensoredError("INPUT_LIMIT");
    }
  }

  function detectJs(text: string): NativeDetection[] {
    const detections: NativeDetection[] = [];

    for (const detector of detectors) {
      for (const { start, end, ruleId, entityType, reasons } of detector.detect(
        text,
      )) {
        detections.push({
          start,
          end,
          ruleId,
          entityType,
          reasons: [...reasons],
        });
      }
    }

    return detections;
  }

  /** Core and JS detections, in policy order as the TS engine collects them. */
  function collect(text: string): NativeDetection[] {
    const detections = [...core.collect(text), ...detectJs(text)];

    if (coreOnly) {
      return detections;
    }

    return detections.sort(
      (a, b) => (ruleOrder.get(a.ruleId) ?? 0) - (ruleOrder.get(b.ruleId) ?? 0),
    );
  }

  function openStream(report: boolean, restoreStream?: boolean): StreamCore {
    const stream = engineCall(() => core.stream(report, restoreStream));

    // A chunk can end inside a surrogate pair, and the engine takes UTF-8
    // strings, so a trailing high surrogate waits for the next chunk.
    let pending = "";

    const push = (text: string) =>
      coreOnly ? stream.push(text) : stream.pushWith(text, detectJs);
    const end = () =>
      coreOnly ? stream.finish() : stream.finishWith(detectJs);

    return {
      push(chunk: string): StreamEvent[] {
        let text = pending + chunk;
        pending = "";

        if (endsWithHighSurrogate(text)) {
          pending = text.slice(-1);
          text = text.slice(0, -1);
        }

        const events = engineCall(() => push(text));

        return events.map(toStreamEvent);
      },
      finish(): StreamEvent[] {
        const events = engineCall(() =>
          pending === "" ? end() : [...push(pending), ...end()],
        );

        return events.map(toStreamEvent);
      },
    };
  }

  /** A JS rule's own `semanticConfirm`, else the built-in's question. */
  function questionFor(ruleId: string): QuestionBuilder | undefined {
    const detector = detectorsById.get(ruleId);

    if (detector === undefined) {
      return builtinQuestion(ruleId);
    }

    return (candidate) => detector.semanticConfirm?.(candidate);
  }

  async function processAsync(text: string): Promise<AsyncRedactResult> {
    checkInput(text);

    const matches = engineCall(() => core.filter(text, collect(text)));
    const contextWindow = split.semantic?.contextWindow ?? 200;
    const candidates: SemanticCandidate[] = [];
    const candidateIndices: number[] = [];

    for (const [index, match] of matches.entries()) {
      const value = text.slice(match.start, match.end);
      const before = text.slice(
        Math.max(0, match.start - contextWindow),
        match.start,
      );
      const after = text.slice(match.end, match.end + contextWindow);
      const question = questionFor(match.ruleId)?.({ value, before, after });

      if (question) {
        candidates.push({
          ruleId: match.ruleId,
          entityType: match.entityType,
          value,
          before,
          after,
          question,
        });

        candidateIndices.push(index);
      }
    }

    const warnings: string[] = [];
    const results = new Map<number, SemanticResult>();

    if (candidates.length > 0) {
      try {
        const confirmed = await getProvider().confirm(candidates);

        for (const [i, result] of confirmed.entries()) {
          const index = candidateIndices[i];

          if (index !== undefined && result) {
            results.set(index, result);
          }
        }
      } catch {
        warnings.push("Semantic confirmation failed; all detections retained.");
      }
    }

    const kept: NativeDetection[] = [];
    const detections: SemanticDetection[] = [];

    for (const [index, match] of matches.entries()) {
      const result = results.get(index);

      if (result && !result.confirmed) {
        continue;
      }

      kept.push(match);
      detections.push({
        ...match,
        semanticConfirmed: true,
        ...(result?.noul !== undefined ? { noul: result.noul } : {}),
      });
    }

    const rendered = engineCall(() => renderCore(text, kept, false));

    return {
      text: rendered.text,
      detections,
      ...(rendered.map ? { map: freezeMap(rendered.map) } : {}),
      ...(warnings.length > 0 ? { warnings: Object.freeze(warnings) } : {}),
    };
  }

  return Object.freeze({
    policy,
    describe(): readonly DetectorDescription[] {
      return descriptions;
    },
    redact(text: string): string | RedactResult {
      checkInput(text);

      if (!split.restore) {
        return engineCall(() =>
          coreOnly
            ? core.redact(text)
            : renderCore(text, collect(text), false).text,
        );
      }

      const result = engineCall(() =>
        coreOnly
          ? core.redactWithMap(text)
          : renderCore(text, collect(text), false),
      );

      return result.map ? { text: result.text, map: result.map } : result.text;
    },
    async redactAsync(text: string): Promise<AsyncRedactResult> {
      return processAsync(text);
    },
    inspect(text: string): Inspection {
      checkInput(text);

      return engineCall(() =>
        coreOnly ? inspectCore(text) : renderCore(text, collect(text), true),
      );
    },
    stream(
      chunks: AsyncIterable<string>,
      options?: StreamOptions,
    ): AsyncIterable<StreamEvent> {
      if (split.semantic) {
        console.warn(
          "sensored: semantic confirmation config is ignored in streaming mode; detections are not semantically confirmed.",
        );
      }

      if (!streamable) {
        throw new SensoredError("STREAM_UNSUPPORTED");
      }

      return createStream(
        () => openStream(options?.report ?? false, options?.restore),
        options?.signal,
      )(chunks);
    },
    restore(text: string, map: RestorationMap): string {
      return restore(text, map);
    },
  });
}
