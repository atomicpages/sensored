import { describe, expect, test } from "bun:test";
import {
  createRedactor,
  type DetectorDefinition,
  type RedactorConfig,
  SensoredError,
  type StreamEvent,
} from "../src";
import { createRedactor as createReference } from "../src/reference";

const BUILTIN_RULES = {
  email: { action: "redact" },
  us_ssn: { action: "redact" },
  phone: { action: "mask" },
} as const;

/** Never matches, so it only switches the redactor onto the hybrid path. */
const idle: DetectorDefinition = {
  id: "idle",
  entityType: "idle",
  replacement: "[IDLE]",
  pattern: /never-matches-anything-zq9/,
  stream: {
    maxMatchLength: 7,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  },
};

/** Overlaps the email built-in: the local part of any address. */
const handle: DetectorDefinition = {
  id: "handle",
  entityType: "handle",
  replacement: "[HANDLE]",
  pattern: /[a-z]+(?=@)/,
  stream: {
    maxMatchLength: 32,
    leftContext: 0,
    rightContext: 1,
    boundaryLookaround: 1,
  },
};

const INPUTS = [
  "nothing here",
  "mail alice@example.com, SSN 123-45-6789, call 415-555-1234",
  "👋🏽 bob@example.org 🇺🇸 ssn 123-45-6789 ünïcödé",
  "[EMAIL] already redacted carol@example.net",
];

async function collect(events: AsyncIterable<StreamEvent>): Promise<string> {
  let text = "";

  for await (const event of events) {
    if (event.type === "text") {
      text += event.text;
    }
  }

  return text;
}

async function* chunked(text: string, at: number): AsyncIterable<string> {
  yield text.slice(0, at);
  yield text.slice(at);
}

describe("fast path vs hybrid path", () => {
  const fast = createRedactor({ rules: BUILTIN_RULES });
  const hybrid = createRedactor({
    rules: { ...BUILTIN_RULES, idle: { action: "redact" } },
    detectors: [idle],
  });

  test.each(INPUTS)("redact and inspect agree: %s", (input) => {
    expect(hybrid.redact(input)).toBe(fast.redact(input));
    expect(hybrid.inspect(input)).toEqual(fast.inspect(input));
  });

  test.each(INPUTS)("restore maps agree: %s", (input) => {
    const config = { rules: BUILTIN_RULES, restore: true } as const;
    const withIdle = createRedactor({
      ...config,
      rules: { ...BUILTIN_RULES, idle: { action: "redact" } },
      detectors: [idle],
    });

    expect(withIdle.redact(input)).toEqual(
      createRedactor(config).redact(input),
    );
  });
});

describe("JS detectors next to built-ins", () => {
  const config: RedactorConfig = {
    rules: { ...BUILTIN_RULES, handle: { action: "redact", priority: 1 } },
    detectors: [handle],
  };

  test.each(INPUTS)("matches the TS reference: %s", (input) => {
    const native = createRedactor(config);
    const reference = createReference(config);

    expect(native.redact(input)).toBe(reference.redact(input));
    expect(native.inspect(input)).toEqual(reference.inspect(input));
  });

  test("redactAsync lists detections in policy order", async () => {
    const input = "a@b.co and 123-45-6789";
    const native = await createRedactor(config).redactAsync(input);
    const reference = await createReference(config).redactAsync(input);

    expect(native).toEqual(reference);
  });

  test("a JS rule that is off does not run", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" }, handle: "off" },
      detectors: [handle],
    });

    expect(redactor.redact("x a@b.co")).toBe("x [EMAIL]");
  });
});

describe("customHeaders RegExps", () => {
  const config: RedactorConfig = {
    rules: { http_auth_header: { action: "redact" } },
    detectorOptions: {
      http_auth_header: {
        customHeaders: ["My-Custom-Auth", /X-Special-Auth\s*:\s*(\S+)/],
      },
    },
  };

  test.each([
    "X-Special-Auth: s3cr3t-value",
    "My-Custom-Auth: abc123 and X-Special-Auth: def456",
    "Authorization: Bearer tok3n X-Special-Auth:zzz",
    "X-Special-Auth: ",
  ])("matches the TS reference: %s", (input) => {
    expect(createRedactor(config).inspect(input)).toEqual(
      createReference(config).inspect(input),
    );
  });

  test("RegExps without http_auth_header enabled are ignored", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      detectorOptions: config.detectorOptions,
    });

    expect(redactor.redact("X-Special-Auth: abc")).toBe("X-Special-Auth: abc");
  });
});

describe("redactAsync with semanticConfirm", () => {
  test("asks JS questions and fails open like the reference", async () => {
    const seen: string[] = [];
    const confirmed: DetectorDefinition = {
      ...handle,
      semanticConfirm: ({ value, before, after }) => {
        seen.push(`${before}|${value}|${after}`);

        return { instructions: "Is this a handle?" };
      },
    };
    const config: RedactorConfig = {
      rules: { handle: { action: "redact" } },
      detectors: [confirmed],
      semantic: { provider: "jev", apiKey: "fake", contextWindow: 3 },
    };

    const native = await createRedactor(config).redactAsync("hi alice@x.io");
    const nativeSeen = seen.splice(0);
    const reference =
      await createReference(config).redactAsync("hi alice@x.io");

    expect(nativeSeen).toEqual(["hi |alice|@x."]);
    expect(seen).toEqual(nativeSeen);
    expect(native).toEqual(reference);
  });

  test("built-in questions come from the rule id", async () => {
    const config: RedactorConfig = {
      rules: { person_name_lite: { action: "redact" } },
    };
    const input = "Contact John Smith today";

    const native = await createRedactor(config).redactAsync(input);
    const reference = await createReference(config).redactAsync(input);

    // No semantic config: the question is asked, the provider is missing,
    // and every detection is kept.
    expect(native.warnings).toEqual([
      "Semantic confirmation failed; all detections retained.",
    ]);
    expect(native).toEqual(reference);
  });
});

describe("hybrid streams", () => {
  const config: RedactorConfig = {
    rules: { ...BUILTIN_RULES, handle: { action: "redact", priority: 1 } },
    detectors: [handle],
  };
  const input = INPUTS[2] ?? "";
  const expected = createReference(config).redact(input);

  test("every split point renders like the complete string", async () => {
    const redactor = createRedactor(config);

    for (let at = 0; at <= input.length; at++) {
      expect(await collect(redactor.stream(chunked(input, at)))).toBe(expected);
    }
  });

  test("detection events carry absolute offsets", async () => {
    const redactor = createRedactor(config);
    const groups = [];

    for await (const event of redactor.stream(chunked(input, 9), {
      report: true,
    })) {
      if (event.type === "detection") {
        groups.push(event.group);
      }
    }

    expect(groups).toEqual([...redactor.inspect(input).groups]);
  });
});

describe("error rewrap", () => {
  function caught(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }

    throw new Error("expected a throw");
  }

  test.each([
    ["unknown rule", { rules: { nope: { action: "redact" } } }],
    ["bad preset", { presets: ["pii@9"], rules: {} }],
    ["empty policy", { rules: { email: "off" } }],
    ["bad descriptor", { rules: {}, detectors: [{ ...handle, id: "Bad" }] }],
  ])("%s keeps code, path and info", (_, config) => {
    const native = caught(() => createRedactor(config as RedactorConfig));
    const reference = caught(() => createReference(config as RedactorConfig));

    expect(native).toBeInstanceOf(SensoredError);
    expect(native).toMatchObject({
      code: (reference as SensoredError).code,
      path: (reference as SensoredError).path,
      info: (reference as SensoredError).info,
    });
  });

  test("a JS detector's contract error passes through", () => {
    const redactor = createRedactor({
      rules: { bad: { action: "redact" } },
      detectors: [
        {
          id: "bad",
          entityType: "bad",
          replacement: "[BAD]",
          pattern: /x/,
          validate: () => ["not valid!"],
        },
      ],
    });

    expect(caught(() => redactor.redact("x"))).toMatchObject({
      code: "DETECTOR_CONTRACT",
    });
  });

  test("input limit is a SensoredError", () => {
    const redactor = createRedactor({
      rules: { email: { action: "redact" } },
      limits: { maxInputLength: 3 },
    });

    expect(caught(() => redactor.redact("abcd"))).toMatchObject({
      code: "INPUT_LIMIT",
    });
  });
});
