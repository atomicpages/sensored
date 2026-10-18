import { SensoredError } from "./errors";
import type { StreamEvent } from "./types";

/**
 * Synchronous streaming state machine: chunks in, events out. Internal.
 * The native engine's stream and the TS reference's `createStreamCore` both
 * satisfy it.
 */
export interface StreamCore {
  push(chunk: string): StreamEvent[];
  finish(): StreamEvent[];
}

/**
 * Drives a `StreamCore` over an async source. `open` runs when iteration
 * starts; callers check `STREAM_UNSUPPORTED` eagerly before calling this.
 * Source errors become `SOURCE_FAILURE`; an aborted `signal` is `CANCELLED`.
 */
export function createStream(
  open: () => StreamCore,
  signal?: AbortSignal,
): (chunks: AsyncIterable<string>) => AsyncIterable<StreamEvent> {
  return async function* (
    chunks: AsyncIterable<string>,
  ): AsyncIterable<StreamEvent> {
    const core = open();
    let tail: StreamEvent[];

    try {
      for await (const chunk of chunks) {
        if (signal?.aborted) {
          throw new SensoredError("CANCELLED");
        }

        yield* core.push(chunk);
      }

      if (signal?.aborted) {
        throw new SensoredError("CANCELLED");
      }

      tail = core.finish();
    } catch (error) {
      if (error instanceof SensoredError) {
        throw error;
      }

      throw new SensoredError("SOURCE_FAILURE");
    }

    yield* tail;
  };
}
