/**
 * Runtime smoke checks shared by every runtime script (Node, Bun, Deno,
 * browser): the public API end to end on whichever engine the entry loaded.
 * Plain JS so each runtime runs it as is. Throws on the first failure.
 */
const INPUT = "Contact alice@example.com or call 555-123-4567 about T-1234.";

const RULES = {
  email: { action: "redact" },
  phone: { action: "redact" },
  ticket_id: { action: "redact" },
};

const TICKET = {
  id: "ticket_id",
  entityType: "ticket",
  replacement: "[TICKET]",
  pattern: /T-\d+/g,
  stream: {
    maxMatchLength: 16,
    leftContext: 0,
    rightContext: 0,
    boundaryLookaround: 1,
  },
};

function check(condition, message) {
  if (!condition) {
    throw new Error(`smoke: ${message}`);
  }
}

export async function smoke({ createRedactor, listDetectors, restore }) {
  const redactor = createRedactor({ rules: RULES, detectors: [TICKET] });
  const text = redactor.redact(INPUT);

  check(text.includes("[EMAIL]"), `email not redacted: ${text}`);
  check(text.includes("[PHONE]"), `phone not redacted: ${text}`);
  check(text.includes("[TICKET]"), `JS detector not applied: ${text}`);

  const restoring = createRedactor({
    rules: RULES,
    detectors: [TICKET],
    restore: true,
  });
  const redacted = restoring.redact(INPUT);

  check(restore(redacted.text, redacted.map) === INPUT, "restore round trip");
  check(redactor.inspect(INPUT).groups.length === 3, "inspect groups");

  async function* chunks() {
    for (let i = 0; i < INPUT.length; i += 7) {
      yield INPUT.slice(i, i + 7);
    }
  }

  let streamed = "";

  for await (const event of redactor.stream(chunks())) {
    if (event.type === "text") {
      streamed += event.text;
    }
  }

  check(streamed === text, `stream differs: ${streamed}`);
  check(listDetectors().length > 150, "listDetectors");

  return text;
}
