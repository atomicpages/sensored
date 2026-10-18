import type { RenderSeed } from "../reference";
import type { JsonRedactorConfig } from "../types";
import {
  BASIC_AUTH,
  CARD,
  CARD_DASHED,
  EMAIL,
  EMAIL_2,
  IBAN,
  IPV4,
  PHONE,
  PRIVATE_KEY,
  SSN,
  URL_WITH_IP,
} from "./values";

const EMAIL_TEXT = `Contact ${EMAIL} today.`;
const CARD_TEXT = `Card ${CARD} on file.`;

type Action =
  | "redact"
  | "mask"
  | "format-preserve"
  | "token-replace"
  | "remove";

/** `url_with_auth` (outer span) and `ipv4` (inner span) with given actions. */
function overlapPair(outer: Action, inner: Action): JsonRedactorConfig {
  return {
    rules: {
      url_with_auth: { action: outer },
      ipv4: { action: inner },
    },
  };
}

const ACTION_RANK: readonly Action[] = [
  "remove",
  "redact",
  "format-preserve",
  "token-replace",
  "mask",
];

/** Each adjacent pair in precedence order, with the stronger action on either span. */
function precedenceSeeds(): RenderSeed[] {
  const seeds: RenderSeed[] = [];

  for (let i = 0; i < ACTION_RANK.length - 1; i++) {
    const strong = ACTION_RANK[i];
    const weak = ACTION_RANK[i + 1];

    if (strong === undefined || weak === undefined) {
      continue;
    }

    seeds.push(
      {
        id: `precedence/${strong}-over-${weak}/outer-${strong}`,
        config: overlapPair(strong, weak),
        input: `See ${URL_WITH_IP} now.`,
      },
      {
        id: `precedence/${strong}-over-${weak}/inner-${strong}`,
        config: overlapPair(weak, strong),
        input: `See ${URL_WITH_IP} now.`,
      },
    );
  }

  return seeds;
}

const PLACEHOLDER_TEXT =
  "Already [EMAIL], [EMAIL_1], [REDACTED] and [US_SSN_12] but not [Email].";

export const renderSeeds: readonly RenderSeed[] = [
  // Actions
  {
    id: "redact/default/email",
    config: { rules: { email: { action: "redact" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "redact/replacement/email",
    config: { rules: { email: { action: "redact", replacement: "<email>" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "redact/replacement-empty/email",
    config: { rules: { email: { action: "redact", replacement: "" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "redact/default/multiple-entities",
    config: {
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
        ipv4: { action: "redact" },
        phone: { action: "redact" },
        iban: { action: "redact" },
      },
    },
    input: `${EMAIL}, ${CARD}, ${IPV4}, ${PHONE}, ${IBAN}.`,
  },
  {
    id: "mask/default/email",
    config: { rules: { email: { action: "mask" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "mask/preserve-first-last/email",
    config: {
      rules: { email: { action: "mask", preserve: { first: 2, last: 4 } } },
    },
    input: EMAIL_TEXT,
  },
  {
    id: "mask/preserve-first/payment-card",
    config: {
      rules: { payment_card: { action: "mask", preserve: { first: 4 } } },
    },
    input: CARD_TEXT,
  },
  {
    id: "mask/preserve-last/payment-card",
    config: {
      rules: { payment_card: { action: "mask", preserve: { last: 4 } } },
    },
    input: CARD_TEXT,
  },
  {
    id: "mask/preserve-exceeds-length/ipv4",
    config: {
      rules: { ipv4: { action: "mask", preserve: { first: 8, last: 8 } } },
    },
    input: `Host ${IPV4} up.`,
  },
  {
    id: "mask/preserve-zero/ipv4",
    config: {
      rules: { ipv4: { action: "mask", preserve: { first: 0, last: 0 } } },
    },
    input: `Host ${IPV4} up.`,
  },
  {
    id: "format-preserve/payment-card",
    config: { rules: { payment_card: { action: "format-preserve" } } },
    input: `Card ${CARD_DASHED} on file.`,
  },
  {
    id: "format-preserve/email",
    config: { rules: { email: { action: "format-preserve" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "format-preserve/iban",
    config: { rules: { iban: { action: "format-preserve" } } },
    input: `IBAN ${IBAN}.`,
  },
  {
    id: "token-replace/default/email",
    config: { rules: { email: { action: "token-replace" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "token-replace/default/multiple-entities",
    config: {
      rules: {
        email: { action: "token-replace" },
        payment_card: { action: "token-replace" },
        ipv4: { action: "token-replace" },
        phone: { action: "token-replace" },
        iban: { action: "token-replace" },
      },
    },
    input: `${EMAIL}, ${CARD}, ${IPV4}, ${PHONE}, ${IBAN}.`,
  },
  {
    id: "token-replace/custom-tokens/email",
    config: {
      rules: {
        email: {
          action: "token-replace",
          tokens: { email: "someone@example.net" },
        },
      },
    },
    input: EMAIL_TEXT,
  },
  {
    id: "token-replace/custom-tokens-other-entity/email",
    config: {
      rules: {
        email: { action: "token-replace", tokens: { ipv4: "198.51.100.1" } },
      },
    },
    input: EMAIL_TEXT,
  },
  {
    id: "remove/email",
    config: { rules: { email: { action: "remove" } } },
    input: EMAIL_TEXT,
  },
  {
    id: "remove/payment-card",
    config: { rules: { payment_card: { action: "remove" } } },
    input: CARD_TEXT,
  },

  // Redact replacement and priority on an overlap
  {
    id: "redact/equal-rank-conflict/redacted-fallback",
    config: overlapPair("redact", "redact"),
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "redact/equal-rank-same-replacement",
    config: {
      rules: {
        url_with_auth: { action: "redact", replacement: "[HIDDEN]" },
        ipv4: { action: "redact", replacement: "[HIDDEN]" },
      },
    },
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "redact/priority/outer-wins",
    config: {
      rules: {
        url_with_auth: { action: "redact", priority: 2 },
        ipv4: { action: "redact", priority: 1 },
      },
    },
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "redact/priority/inner-wins",
    config: {
      rules: {
        url_with_auth: { action: "redact", priority: 1 },
        ipv4: { action: "redact", priority: 2 },
      },
    },
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "redact/priority/negative",
    config: {
      rules: {
        url_with_auth: { action: "redact", priority: -1 },
        ipv4: { action: "redact" },
      },
    },
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "redact/priority/equal-conflict",
    config: {
      rules: {
        url_with_auth: { action: "redact", priority: 3 },
        ipv4: { action: "redact", priority: 3 },
      },
    },
    input: `See ${URL_WITH_IP} now.`,
  },

  // Overlap groups
  {
    id: "overlap/nested/mask-union",
    config: {
      rules: {
        url_with_auth: { action: "mask", preserve: { first: 8 } },
        ipv4: { action: "mask", preserve: { last: 3 } },
      },
    },
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "overlap/transitive/card-digit-groups",
    config: {
      rules: {
        payment_card: { action: "token-replace" },
        jp_my_number: { action: "mask" },
        postal_code: { action: "mask" },
      },
    },
    input: CARD_TEXT,
  },
  {
    id: "overlap/transitive/without-bridge",
    config: {
      rules: {
        jp_my_number: { action: "redact" },
        postal_code: { action: "redact" },
      },
    },
    input: CARD_TEXT,
  },
  {
    id: "overlap/context-and-postal-code",
    config: {
      rules: { us_ssn: { action: "redact" }, postal_code: { action: "mask" } },
    },
    input: `SSN: ${SSN} on file.`,
  },
  {
    id: "adjacent/private-keys/redact",
    config: { rules: { private_key: { action: "redact" } } },
    input: `${PRIVATE_KEY}${PRIVATE_KEY}`,
  },
  {
    id: "adjacent/private-keys/mask",
    config: {
      rules: {
        private_key: { action: "mask", preserve: { first: 5, last: 5 } },
      },
    },
    input: `${PRIVATE_KEY}${PRIVATE_KEY}`,
  },
  {
    id: "adjacent/one-char-apart/ipv4-postal-code",
    config: {
      rules: { ipv4: { action: "redact" }, postal_code: { action: "redact" } },
    },
    input: `Bind ${IPV4}:8080 now.`,
  },
  ...precedenceSeeds(),

  // Allowlist and detect-only
  {
    id: "allowlist/exact-match",
    config: { rules: { email: { action: "redact" } }, allowlist: [EMAIL_2] },
    input: `${EMAIL} and ${EMAIL_2}.`,
  },
  {
    id: "allowlist/case-sensitive",
    config: {
      rules: { email: { action: "redact" } },
      allowlist: [EMAIL_2.toUpperCase()],
    },
    input: `${EMAIL} and ${EMAIL_2}.`,
  },
  {
    id: "allowlist/overlap-member",
    config: { ...overlapPair("redact", "redact"), allowlist: [IPV4] },
    input: `See ${URL_WITH_IP} now.`,
  },
  {
    id: "detect-only/email-and-card",
    config: {
      rules: { email: { action: "redact" }, payment_card: { action: "mask" } },
      detectOnly: true,
    },
    input: `${EMAIL} paid with ${CARD}.`,
  },
  {
    id: "detect-only/overlap",
    config: { ...overlapPair("redact", "remove"), detectOnly: true },
    input: `See ${URL_WITH_IP} now.`,
  },

  // Restore
  {
    id: "restore/redact/multiple-entities",
    config: {
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
        ipv4: { action: "redact" },
      },
      restore: true,
    },
    input: `${EMAIL} paid with ${CARD} from ${IPV4}; cc ${EMAIL_2} and ${EMAIL}.`,
  },
  {
    id: "restore/redact/custom-replacement",
    config: {
      rules: { email: { action: "redact", replacement: "<email>" } },
      restore: true,
    },
    input: `${EMAIL} and ${EMAIL_2}.`,
  },
  {
    id: "restore/mask/email",
    config: { rules: { email: { action: "mask" } }, restore: true },
    input: `${EMAIL} and ${EMAIL_2}.`,
  },
  {
    id: "restore/token-replace/email",
    config: { rules: { email: { action: "token-replace" } }, restore: true },
    input: `${EMAIL} and ${EMAIL_2}.`,
  },
  {
    id: "restore/remove/email",
    config: { rules: { email: { action: "remove" } }, restore: true },
    input: `${EMAIL} and ${EMAIL_2}.`,
  },
  {
    id: "restore/format-preserve/payment-card",
    config: {
      rules: { payment_card: { action: "format-preserve" } },
      restore: true,
    },
    input: CARD_TEXT,
  },
  {
    id: "restore/overlap/redacted-fallback",
    config: { ...overlapPair("redact", "redact"), restore: true },
    input: `See ${URL_WITH_IP} and ${IPV4}.`,
  },
  {
    id: "restore/no-matches",
    config: { rules: { email: { action: "redact" } }, restore: true },
    input: "Nothing to see here.",
  },

  // Placeholder idempotency
  {
    id: "idempotency/placeholders-untouched",
    config: { rules: { email: { action: "redact" } } },
    input: PLACEHOLDER_TEXT,
  },
  {
    id: "idempotency/placeholder-next-to-value",
    config: { rules: { email: { action: "redact" } } },
    input: `[EMAIL] ${EMAIL} [EMAIL_2]`,
  },
  {
    id: "idempotency/re-redact-output/multiple-entities",
    config: {
      rules: {
        email: { action: "redact" },
        payment_card: { action: "redact" },
        ipv4: { action: "redact" },
        postal_code: { action: "redact" },
      },
    },
    input: "[EMAIL] paid with [PAYMENT_CARD] from [IPV4] at [REDACTED].",
  },
  {
    id: "idempotency/re-redact-output/restore-placeholders",
    config: {
      rules: { email: { action: "redact" }, postal_code: { action: "redact" } },
      restore: true,
    },
    input: "[EMAIL_1] and [EMAIL_2] near [POSTAL_CODE_10001].",
  },

  // Context-required detectors (us_ssn: 39 units left, 32 right)
  {
    id: "context/us-ssn/label-preceding",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `SSN: ${SSN}`,
  },
  {
    id: "context/us-ssn/label-following",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `${SSN} is the SSN on record.`,
  },
  {
    id: "context/us-ssn/label-long-form",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `Social Security Number ${SSN}`,
  },
  {
    id: "context/us-ssn/label-inside-left-window",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `SSN ${"x".repeat(30)} ${SSN}`,
  },
  {
    id: "context/us-ssn/label-outside-left-window",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `SSN ${"x".repeat(40)} ${SSN}`,
  },
  {
    id: "context/us-ssn/label-outside-right-window",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `${SSN} ${"x".repeat(40)} SSN`,
  },
  {
    id: "context/us-ssn/no-label",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `Reference ${SSN} only.`,
  },
  {
    id: "context/us-ssn/one-label-two-values",
    config: { rules: { us_ssn: { action: "redact" } } },
    input: `SSN: ${SSN} and later ${SSN}`,
  },

  // Detector options
  {
    id: "detector-options/http-auth-header/builtin-headers",
    config: { rules: { http_auth_header: { action: "redact" } } },
    input: `${BASIC_AUTH}\nX-Api-Key: example-key-123\nX-Example-Auth: example-value-1\n`,
  },
  {
    id: "detector-options/http-auth-header/custom-headers",
    config: {
      rules: { http_auth_header: { action: "redact" } },
      detectorOptions: {
        http_auth_header: { customHeaders: ["X-Example-Auth", "Session.Id"] },
      },
    },
    input: `${BASIC_AUTH}\nX-Example-Auth: example-value-1\nSession.Id: abc123\nSessionXId: abc123\n`,
  },
];
