import { createRedactor, restore } from "../index";
import { resolvePolicy } from "../policy";
import type { Session } from "../session";
import { StreamRestorer } from "../stream-restore";
import { redactValue } from "../traverse";
import type { RedactorConfig, RestorationMap } from "../types";
import {
  createSharedRedactor,
  isSession,
  type RedactionAdapter,
} from "./shared";

const WRAPPED = Symbol("sensored.openai.wrapped");

export function wrapOpenAI<T extends object>(
  client: T,
  config: RedactorConfig,
): T;
export function wrapOpenAI<T extends object>(client: T, session: Session): T;
export function wrapOpenAI<T extends object>(
  client: T,
  configOrSession: RedactorConfig | Session,
): T {
  if ((client as Record<symbol, unknown>)[WRAPPED]) {
    return client;
  }

  let adapter: RedactionAdapter;
  let detectOnly: boolean;

  if (isSession(configOrSession)) {
    adapter = configOrSession;
    detectOnly = false;
  } else {
    const {
      rules,
      allowlist,
      detectOnly: doFlag,
    } = resolvePolicy(configOrSession);
    adapter = createSharedRedactor(rules, allowlist);
    detectOnly = doFlag;
  }

  type CreateFn = (params: Record<string, unknown>) => Promise<unknown>;

  const chat = (
    client as {
      chat?: {
        completions?: {
          create?: CreateFn;
        };
      };
    }
  ).chat;
  if (!chat?.completions?.create) {
    return client;
  }

  const originalCreate = chat.completions.create.bind(
    chat.completions,
  ) as CreateFn;

  chat.completions.create = async (params: Record<string, unknown>) => {
    const messages = params.messages;

    const redactedMessages = detectOnly
      ? messages
      : redactValue(messages, adapter);

    const response = await originalCreate({
      ...params,
      messages: redactedMessages,
    });

    if (detectOnly) {
      return response;
    }

    const map = adapter.map;

    if (params.stream) {
      return wrapOpenAIStream(
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

function wrapOpenAIStream(
  stream: AsyncIterable<Record<string, unknown>>,
  map: RestorationMap,
): AsyncIterable<Record<string, unknown>> {
  const restorer = new StreamRestorer(map);

  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of stream) {
        const restored = { ...chunk };
        const choices =
          (restored.choices as Array<Record<string, unknown>>) ?? [];
        restored.choices = choices.map((choice) => {
          const delta = choice.delta as Record<string, unknown> | undefined;
          if (!delta) {
            return choice;
          }

          const restoredDelta: Record<string, unknown> = { ...delta };

          if (typeof delta.content === "string") {
            restoredDelta.content = restorer.push(delta.content);
          }

          if (Array.isArray(delta.tool_calls)) {
            restoredDelta.tool_calls = delta.tool_calls.map(
              (tc: Record<string, unknown>) => {
                const fn = tc.function as { arguments?: string } | undefined;
                if (fn && typeof fn.arguments === "string") {
                  return {
                    ...tc,
                    function: {
                      ...fn,
                      arguments: restorer.push(fn.arguments),
                    },
                  };
                }
                return tc;
              },
            );
          }

          return { ...choice, delta: restoredDelta };
        });

        yield restored;
      }

      const remaining = restorer.flush();
      if (remaining) {
        yield {
          choices: [
            { delta: { content: remaining }, finish_reason: null, index: 0 },
          ],
        };
      }
    },
  };
}

export function redactPrompt(
  text: string,
  config: RedactorConfig,
): { text: string; map: RestorationMap } {
  const redactor = createRedactor({ ...config, restore: true });
  const result = redactor.redact(text);
  return typeof result === "string" ? { text: result, map: {} } : result;
}
