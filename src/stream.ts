import {
  createRestorationContext,
  detectAndRender,
  type RestorationContext,
} from "./engine";
import { SensoredError } from "./errors";
import { graphemeBoundaries, graphemeBoundaryAt } from "./grapheme";
import type {
  ActiveRule,
  InspectionGroup,
  RestorationMap,
  StreamEvent,
  StreamOptions,
} from "./types";

const BUFFER_LIMIT = 65536;

export function createStream(
  rules: readonly ActiveRule[],
  options?: StreamOptions & {
    allowlist?: Set<string>;
    semantic?: unknown;
    detectOnly?: boolean;
  },
): (chunks: AsyncIterable<string>) => AsyncIterable<StreamEvent> {
  for (const rule of rules) {
    if (!rule.detector.stream) {
      throw new SensoredError("STREAM_UNSUPPORTED");
    }
  }

  const report = options?.report ?? false;
  const signal = options?.signal;
  const restoreEnabled = options?.restore ?? false;
  const detectOnly = options?.detectOnly ?? false;
  const allowlist = options?.allowlist ?? new Set<string>();
  const restoration: RestorationContext | undefined =
    restoreEnabled && !detectOnly ? createRestorationContext() : undefined;

  function adjustForGrapheme(buffer: string, flushPoint: number): number {
    if (flushPoint <= 0) {
      return 0;
    }

    // ASCII fast path: every position between ASCII characters is a boundary.
    if (graphemeBoundaryAt(buffer, flushPoint)) {
      return flushPoint;
    }

    // Non-ASCII: fall back to full boundary Set.
    const boundaries = graphemeBoundaries(buffer);

    while (flushPoint > 0 && !boundaries.has(flushPoint)) {
      flushPoint--;
    }

    return flushPoint;
  }

  function calculateFlushPoint(buffer: string): number {
    let flushPoint = buffer.length;

    for (const rule of rules) {
      const stream = rule.detector.stream!;

      const safeBoundary =
        buffer.length -
        stream.maxMatchLength -
        Math.max(stream.leftContext, stream.rightContext) -
        stream.boundaryLookaround;

      flushPoint = Math.min(flushPoint, safeBoundary);
    }

    return adjustForGrapheme(buffer, flushPoint);
  }

  function* emitSegments(
    segments: { text: string; group?: InspectionGroup }[],
    absoluteOffset: number,
  ): Generator<StreamEvent> {
    for (const segment of segments) {
      if (segment.group !== undefined) {
        const group = segment.group;

        if (detectOnly) {
          yield { type: "text", text: segment.text };
        }

        yield {
          type: "detection",
          group: {
            start: group.start + absoluteOffset,
            end: group.end + absoluteOffset,
            replacement: group.replacement,
            matches: group.matches.map((m) => ({
              ...m,
              start: m.start + absoluteOffset,
              end: m.end + absoluteOffset,
            })),
          },
        };
      } else {
        yield { type: "text", text: segment.text };
      }
    }
  }

  const maxLeftContext = Math.max(
    0,
    ...rules.map((r) => r.detector.stream?.leftContext),
  );

  return async function* (
    chunks: AsyncIterable<string>,
  ): AsyncIterable<StreamEvent> {
    let buffer = "";
    let absoluteOffset = 0;
    let consumedCursor = 0;

    try {
      for await (const chunk of chunks) {
        if (signal?.aborted) {
          throw new SensoredError("CANCELLED");
        }

        buffer += chunk;

        if (buffer.length > BUFFER_LIMIT) {
          throw new SensoredError("BUFFER_LIMIT");
        }

        const flushPoint = calculateFlushPoint(buffer);

        if (flushPoint <= 0) {
          continue;
        }

        const { segments, consumed } = detectAndRender(
          buffer,
          rules,
          flushPoint,
          report,
          consumedCursor,
          restoration,
          allowlist,
          detectOnly,
        );

        if (consumed <= consumedCursor) {
          continue;
        }

        yield* emitSegments(segments, absoluteOffset);

        consumedCursor = consumed;

        if (consumedCursor > maxLeftContext) {
          const trimPoint = consumedCursor - maxLeftContext;
          buffer = buffer.slice(trimPoint);
          absoluteOffset += trimPoint;
          consumedCursor -= trimPoint;
        }
      }

      if (signal?.aborted) {
        throw new SensoredError("CANCELLED");
      }

      if (buffer.length > 0) {
        const { segments } = detectAndRender(
          buffer,
          rules,
          buffer.length,
          report,
          consumedCursor,
          restoration,
          allowlist,
          detectOnly,
        );

        yield* emitSegments(segments, absoluteOffset);
      }
    } catch (error) {
      if (error instanceof SensoredError) {
        throw error;
      }

      throw new SensoredError("SOURCE_FAILURE");
    }

    if (restoration) {
      yield {
        type: "complete",
        map: Object.freeze(
          Object.fromEntries(restoration.map.entries()),
        ) as RestorationMap,
      };
    } else {
      yield { type: "complete" };
    }
  };
}
