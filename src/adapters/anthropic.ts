import { restore } from "../index";
import { resolvePolicy } from "../policy";
import { StreamRestorer } from "../stream-restore";
import { redactValue } from "../traverse";
import type { RedactorConfig, RestorationMap } from "../types";
import { createSharedRedactor } from "./shared";

const WRAPPED = Symbol("sensored.anthropic.wrapped");

export function wrapAnthropic<T extends object>(
  client: T,
  config: RedactorConfig,
): T {
  if ((client as Record<symbol, unknown>)[WRAPPED]) {
    return client;
  }

  const { rules, allowlist, detectOnly } = resolvePolicy(config);
  const shared = createSharedRedactor(rules, allowlist);

  type CreateFn = (params: Record<string, unknown>) => Promise<unknown>;

  const messages = (
    client as {
      messages?: {
        create?: CreateFn;
      };
    }
  ).messages;
  if (!messages?.create) {
    return client;
  }

  const originalCreate = messages.create.bind(messages) as CreateFn;

  messages.create = async (params: Record<string, unknown>) => {
    if (detectOnly) {
      return originalCreate(params);
    }

    const redactedParams = { ...params };

    if (params.system) {
      redactedParams.system = redactValue(params.system, shared);
    }

    if (params.messages) {
      redactedParams.messages = redactValue(params.messages, shared);
    }

    const response = await originalCreate(redactedParams);

    const map = shared.map;

    if (params.stream) {
      return wrapAnthropicStream(
        response as AsyncIterable<Record<string, unknown>>,
        map,
      );
    }

    return redactValue(response, {
      redact: (text: string) => restore(text, map),
    });
  };

  (client as Record<symbol, unknown>)[WRAPPED] = true;
  return client;
}

function wrapAnthropicStream(
  stream: AsyncIterable<Record<string, unknown>>,
  map: RestorationMap,
): AsyncIterable<Record<string, unknown>> {
  const restorers = new Map<number, StreamRestorer>();

  function getRestorer(index: number): StreamRestorer {
    let restorer = restorers.get(index);
    if (!restorer) {
      restorer = new StreamRestorer(map);
      restorers.set(index, restorer);
    }
    return restorer;
  }

  return {
    async *[Symbol.asyncIterator]() {
      for await (const event of stream) {
        const type = event.type as string;

        if (type === "content_block_delta") {
          const index = event.index as number;
          const delta = event.delta as Record<string, unknown>;

          if (delta.type === "text_delta") {
            const restorer = getRestorer(index);
            yield {
              ...event,
              delta: { ...delta, text: restorer.push(delta.text as string) },
            };
          } else if (delta.type === "partial_json") {
            const restorer = getRestorer(index);
            yield {
              ...event,
              delta: {
                ...delta,
                partial_json: restorer.push(delta.partial_json as string),
              },
            };
          } else {
            yield event;
          }
        } else if (type === "content_block_stop") {
          const index = event.index as number;
          const restorer = restorers.get(index);

          if (restorer) {
            const remaining = restorer.flush();
            if (remaining) {
              yield {
                type: "content_block_delta",
                index,
                delta: { type: "text_delta", text: remaining },
              };
            }
          }

          yield event;
        } else {
          yield event;
        }
      }
    },
  };
}
