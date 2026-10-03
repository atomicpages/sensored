import { describe, expect, test } from "bun:test";
import { redactPrompt, wrapOpenAI } from "../../src/adapters/openai";

describe("wrapOpenAI", () => {
  test("non-streaming: messages redacted, response restored", async () => {
    let capturedMessages: unknown;
    const fakeClient = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedMessages = params.messages;
            return {
              choices: [
                {
                  message: {
                    content: "Hello [EMAIL_1]",
                    role: "assistant",
                  },
                },
              ],
            };
          },
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const response = await wrapped.chat.completions.create({
      messages: [{ role: "user", content: "Contact alice@example.com" }],
    });

    const msgs = capturedMessages as Array<Record<string, unknown>>;
    expect(msgs[0]?.content).toBe("Contact [EMAIL_1]");

    const choices = response.choices as Array<Record<string, unknown>>;
    const message = choices[0]?.message as Record<string, unknown>;
    expect(message.content).toBe("Hello alice@example.com");
  });

  test("streaming: chunks restored, split placeholders handled", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: async (_params: Record<string, unknown>) => {
            return (async function* () {
              yield {
                choices: [
                  {
                    delta: { content: "Hello [EMA" },
                    finish_reason: null,
                    index: 0,
                  },
                ],
              };
              yield {
                choices: [
                  {
                    delta: { content: "IL_1] world" },
                    finish_reason: null,
                    index: 0,
                  },
                ],
              };
            })();
          },
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const stream = await wrapped.chat.completions.create({
      messages: [{ role: "user", content: "Contact alice@example.com" }],
      stream: true,
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      const choices = chunk.choices as Array<Record<string, unknown>>;
      const delta = choices[0]?.delta as Record<string, unknown>;
      if (typeof delta.content === "string") {
        chunks.push(delta.content);
      }
    }

    expect(chunks.join("")).toBe("Hello alice@example.com world");
  });

  test("tool-call arguments are redacted and restored", async () => {
    let capturedMessages: unknown;
    const fakeClient = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedMessages = params.messages;
            return {
              choices: [
                {
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call_1",
                        type: "function",
                        function: {
                          name: "make_call",
                          arguments: '{"to": "[PHONE_1]"}',
                        },
                      },
                    ],
                  },
                },
              ],
            };
          },
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { phone: { action: "redact" } },
      restore: true,
    });

    const response = await wrapped.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "make_call",
                arguments: '{"to": "+1-555-123-4567"}',
              },
            },
          ],
        },
      ],
    });

    const msgs = capturedMessages as Array<Record<string, unknown>>;
    const msg = msgs[0] as Record<string, unknown>;
    const tc = (msg.tool_calls as Array<Record<string, unknown>>)[0]!;
    const fn = tc.function as Record<string, unknown>;
    expect(fn.arguments).toBe('{"to": "[PHONE_1]"}');

    const choices = response.choices as Array<Record<string, unknown>>;
    const message = choices[0]?.message as Record<string, unknown>;
    const respTc = (message.tool_calls as Array<Record<string, unknown>>)[0]!;
    const respFn = respTc.function as Record<string, unknown>;
    expect(respFn.arguments).toBe('{"to": "+1-555-123-4567"}');
  });

  test("streaming: tool-call arguments restored across chunks", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: async (_params: Record<string, unknown>) => {
            return (async function* () {
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          function: { arguments: '{"to": "[PHO' },
                        },
                      ],
                    },
                    finish_reason: null,
                    index: 0,
                  },
                ],
              };
              yield {
                choices: [
                  {
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          function: { arguments: 'NE_1]"}' },
                        },
                      ],
                    },
                    finish_reason: null,
                    index: 0,
                  },
                ],
              };
            })();
          },
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { phone: { action: "redact" } },
      restore: true,
    });

    const stream = await wrapped.chat.completions.create({
      messages: [{ role: "user", content: "Call +1-555-123-4567" }],
      stream: true,
    });

    const argChunks: string[] = [];
    for await (const chunk of stream) {
      const choices = chunk.choices as Array<Record<string, unknown>>;
      const delta = choices[0]?.delta as Record<string, unknown>;
      if (Array.isArray(delta.tool_calls)) {
        const tc = (delta.tool_calls as Array<Record<string, unknown>>)[0]!;
        const fn = tc.function as { arguments?: string };
        if (fn.arguments) {
          argChunks.push(fn.arguments);
        }
      }
    }

    expect(argChunks.join("")).toBe('{"to": "+1-555-123-4567"}');
  });

  test("idempotent wrapping (wrap twice does not double-wrap)", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "ok" } }],
          }),
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { email: { action: "redact" } },
    });

    const doubleWrapped = wrapOpenAI(wrapped, {
      rules: { email: { action: "redact" } },
    });

    expect(doubleWrapped).toBe(wrapped);
  });

  test("redactPrompt returns text and map", () => {
    const result = redactPrompt("Contact alice@example.com", {
      rules: { email: { action: "redact" } },
    });

    expect(result.text).toBe("Contact [EMAIL_1]");
    expect(result.map["[EMAIL_1]"]).toBe("alice@example.com");
  });

  test("null content passes through", async () => {
    const fakeClient = {
      chat: {
        completions: {
          create: async (_params: Record<string, unknown>) => {
            return {
              choices: [{ message: { content: null, role: "assistant" } }],
            };
          },
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const response = await wrapped.chat.completions.create({
      messages: [{ role: "user", content: "test" }],
    });

    const choices = response.choices as Array<Record<string, unknown>>;
    const message = choices[0]?.message as Record<string, unknown>;
    expect(message.content).toBeNull();
  });

  test("detectOnly mode: prompts not modified", async () => {
    let capturedMessages: unknown;
    const fakeClient = {
      chat: {
        completions: {
          create: async (params: Record<string, unknown>) => {
            capturedMessages = params.messages;
            return { choices: [{ message: { content: "ok" } }] };
          },
        },
      },
    };

    const wrapped = wrapOpenAI(fakeClient, {
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });

    await wrapped.chat.completions.create({
      messages: [{ role: "user", content: "alice@example.com" }],
    });

    const msgs = capturedMessages as Array<Record<string, unknown>>;
    expect(msgs[0]?.content).toBe("alice@example.com");
  });
});
