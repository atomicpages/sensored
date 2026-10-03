import { describe, expect, test } from "bun:test";
import { wrapAnthropic } from "../../src/adapters/anthropic";

describe("wrapAnthropic", () => {
  test("non-streaming: messages + system prompt redacted, response restored", async () => {
    let capturedParams: Record<string, unknown>;
    const fakeClient = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          capturedParams = params;
          return {
            content: [{ type: "text", text: "Hello [EMAIL_1]" }],
          };
        },
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const response = await wrapped.messages.create({
      model: "claude-3-opus",
      system: "System prompt with alice@example.com",
      messages: [{ role: "user", content: "Contact alice@example.com" }],
      max_tokens: 1024,
    });

    expect(capturedParams?.model).toBe("claude-3-opus");
    expect(capturedParams?.max_tokens).toBe(1024);
    expect(capturedParams?.system).toBe("System prompt with [EMAIL_1]");

    const msgs = capturedParams?.messages as Array<Record<string, unknown>>;
    expect(msgs[0]?.content).toBe("Contact [EMAIL_2]");

    const content = response.content as Array<Record<string, unknown>>;
    expect(content[0]?.text).toBe("Hello alice@example.com");
  });

  test("streaming: text_delta events restored", async () => {
    const fakeClient = {
      messages: {
        create: async (_params: Record<string, unknown>) => {
          return (async function* () {
            yield { type: "message_start", message: {} };
            yield {
              type: "content_block_start",
              index: 0,
              content_block: { type: "text", text: "" },
            };
            yield {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "Hello [EMA" },
            };
            yield {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "IL_1] world" },
            };
            yield { type: "content_block_stop", index: 0 };
            yield { type: "message_stop" };
          })();
        },
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const stream = await wrapped.messages.create({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Contact alice@example.com" }],
      stream: true,
      max_tokens: 1024,
    });

    const textParts: string[] = [];
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown>;
        if (delta.type === "text_delta") {
          textParts.push(delta.text as string);
        }
      }
    }

    expect(textParts.join("")).toBe("Hello alice@example.com world");
  });

  test("system prompt as text blocks is redacted", async () => {
    let capturedParams: Record<string, unknown>;
    const fakeClient = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          capturedParams = params;
          return { content: [{ type: "text", text: "ok" }] };
        },
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    await wrapped.messages.create({
      model: "claude-3-opus",
      system: [{ type: "text", text: "Instructions with bob@example.com" }],
      messages: [{ role: "user", content: "test" }],
      max_tokens: 1024,
    });

    const sys = capturedParams?.system as Array<Record<string, unknown>>;
    expect(sys[0]?.text).toBe("Instructions with [EMAIL_1]");
  });

  test("content blocks with tool_use are redacted and restored", async () => {
    let capturedParams: Record<string, unknown>;
    const fakeClient = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          capturedParams = params;
          return {
            content: [
              {
                type: "tool_use",
                id: "toolu_1",
                name: "send_email",
                input: { to: "[EMAIL_1]" },
              },
            ],
          };
        },
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const response = await wrapped.messages.create({
      model: "claude-3-opus",
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_1",
              name: "send_email",
              input: { to: "alice@example.com" },
            },
          ],
        },
      ],
      max_tokens: 1024,
    });

    const msgs = capturedParams?.messages as Array<Record<string, unknown>>;
    const content = msgs[0]?.content as Array<Record<string, unknown>>;
    expect((content[0]?.input as Record<string, unknown>).to).toBe("[EMAIL_1]");

    const respContent = response.content as Array<Record<string, unknown>>;
    expect((respContent[0]?.input as Record<string, unknown>).to).toBe(
      "alice@example.com",
    );
  });

  test("idempotent wrapping", () => {
    const fakeClient = {
      messages: {
        create: async () => ({ content: [{ type: "text", text: "ok" }] }),
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
    });

    const doubleWrapped = wrapAnthropic(wrapped, {
      rules: { email: { action: "redact" } },
    });

    expect(doubleWrapped).toBe(wrapped);
  });

  test("streaming with partial_json events restored", async () => {
    const fakeClient = {
      messages: {
        create: async (_params: Record<string, unknown>) => {
          return (async function* () {
            yield { type: "message_start", message: {} };
            yield {
              type: "content_block_start",
              index: 0,
              content_block: { type: "tool_use", id: "toolu_1", name: "test" },
            };
            yield {
              type: "content_block_delta",
              index: 0,
              delta: { type: "partial_json", partial_json: '{"to":"[EMA' },
            };
            yield {
              type: "content_block_delta",
              index: 0,
              delta: { type: "partial_json", partial_json: 'IL_1]"}' },
            };
            yield { type: "content_block_stop", index: 0 };
            yield { type: "message_stop" };
          })();
        },
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
      restore: true,
    });

    const stream = await wrapped.messages.create({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Contact alice@example.com" }],
      stream: true,
      max_tokens: 1024,
    });

    const jsonParts: string[] = [];
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown>;
        if (delta.type === "partial_json") {
          jsonParts.push(delta.partial_json as string);
        }
      }
    }

    expect(jsonParts.join("")).toBe('{"to":"alice@example.com"}');
  });

  test("detectOnly mode: prompts not modified", async () => {
    let capturedParams: Record<string, unknown>;
    const fakeClient = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          capturedParams = params;
          return { content: [{ type: "text", text: "ok" }] };
        },
      },
    };

    const wrapped = wrapAnthropic(fakeClient, {
      rules: { email: { action: "redact" } },
      detectOnly: true,
    });

    await wrapped.messages.create({
      model: "claude-3-opus",
      messages: [{ role: "user", content: "alice@example.com" }],
      max_tokens: 1024,
    });

    const msgs = capturedParams?.messages as Array<Record<string, unknown>>;
    expect(msgs[0]?.content).toBe("alice@example.com");
  });
});
