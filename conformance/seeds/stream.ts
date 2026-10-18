import type { StreamSeed } from "../reference";
import type { JsonRedactorConfig } from "../types";
import {
  CARD,
  EMAIL,
  EMAIL_2,
  IBAN,
  IPV4,
  IPV6,
  MAC,
  PHONE,
  SSN,
} from "./values";

/*
 * The engine only flushes mid-stream once the buffer outgrows every active
 * rule's window (maxMatchLength + context + lookaround). Most seeds use rules
 * with small windows (ipv4 16, postal_code 11, phone 21, payment_card 38,
 * us_ssn 51) and inputs well past them, so the split points really cross
 * flush boundaries. Wide-window rules (email 255) are kept for coverage of
 * whole-buffer behaviour.
 */

const REPORT = { report: true, restore: false };
const QUIET = { report: false, restore: false };
const RESTORE = { report: true, restore: true };

const NETWORK: JsonRedactorConfig = {
  rules: {
    ipv4: { action: "redact" },
    ipv6: { action: "redact" },
    mac_address: { action: "redact" },
  },
};

const NETWORK_TEXT = `Hosts ${IPV4} and 198.51.100.7 talk to ${IPV6} via ${MAC}; gateway 203.0.113.1, backup ${IPV4}, last seen ${IPV4} again.`;

const MULTI: JsonRedactorConfig = {
  rules: {
    ipv4: { action: "redact" },
    payment_card: { action: "mask", preserve: { last: 4 } },
    phone: { action: "format-preserve" },
    iban: { action: "token-replace" },
    uk_nino: { action: "remove" },
  },
};

const MULTI_TEXT = `Paid ${CARD} from ${IPV4}; call ${PHONE} or wire to ${IBAN}. NINO AB123456C on file, retry from 198.51.100.7.`;

const CARD_GROUPS: JsonRedactorConfig = {
  rules: {
    payment_card: { action: "token-replace" },
    jp_my_number: { action: "mask" },
    postal_code: { action: "mask" },
  },
};

const SSN_RULES: JsonRedactorConfig = {
  rules: { us_ssn: { action: "redact" }, postal_code: { action: "mask" } },
};

export const streamSeeds: readonly StreamSeed[] = [
  // Flushes mid-stream
  {
    id: "network/redact/quiet",
    config: NETWORK,
    options: QUIET,
    input: NETWORK_TEXT,
  },
  {
    id: "network/redact/report",
    config: NETWORK,
    options: REPORT,
    input: NETWORK_TEXT,
  },
  {
    id: "network/redact/restore",
    config: NETWORK,
    options: RESTORE,
    input: NETWORK_TEXT,
  },
  {
    id: "network/restore-from-config",
    config: { ...NETWORK, restore: true },
    options: { report: false, restore: true },
    input: NETWORK_TEXT,
  },
  {
    id: "network/mask/preserve-first-last",
    config: {
      rules: { ipv4: { action: "mask", preserve: { first: 3, last: 2 } } },
    },
    options: REPORT,
    input: NETWORK_TEXT,
  },
  {
    id: "mixed-actions/report",
    config: MULTI,
    options: REPORT,
    input: MULTI_TEXT,
  },
  {
    id: "mixed-actions/restore",
    config: MULTI,
    options: RESTORE,
    input: MULTI_TEXT,
  },
  {
    id: "overlap/transitive/card-digit-groups",
    config: CARD_GROUPS,
    options: REPORT,
    input: `Card ${CARD} on file, second card ${CARD} expired, zip 10001 and 94105 noted.`,
  },
  {
    id: "overlap/transitive/card-digit-groups/restore",
    config: CARD_GROUPS,
    options: RESTORE,
    input: `Card ${CARD} on file, second card ${CARD} expired, zip 10001 and 94105 noted.`,
  },
  {
    id: "context/us-ssn/label-preceding",
    config: SSN_RULES,
    options: REPORT,
    input: `Applicant record follows. SSN: ${SSN} received; spouse Social Security Number ${SSN} pending review by the office.`,
  },
  {
    id: "context/us-ssn/label-following",
    config: SSN_RULES,
    options: REPORT,
    input: `Applicant record follows. Number ${SSN} is the SSN on record; reference 987-65-4321 has no label at all here.`,
  },
  {
    id: "context/us-ssn/label-outside-window",
    config: SSN_RULES,
    options: REPORT,
    input: `SSN ${"x".repeat(40)} ${SSN} and then ${"y".repeat(40)} SSN`,
  },
  {
    id: "allowlist/exact-match",
    config: { ...NETWORK, allowlist: ["198.51.100.7"] },
    options: REPORT,
    input: NETWORK_TEXT,
  },
  {
    id: "detect-only/network",
    config: { ...NETWORK, detectOnly: true },
    options: REPORT,
    input: NETWORK_TEXT,
  },
  {
    id: "detect-only/network/restore-option",
    config: { ...NETWORK, detectOnly: true },
    options: RESTORE,
    input: NETWORK_TEXT,
  },
  {
    id: "idempotency/placeholders-untouched",
    config: NETWORK,
    options: REPORT,
    input: `Already [IPV4] and [IPV4_1] and [REDACTED], new ${IPV4}; then [MAC_ADDRESS_2] and ${MAC} and [IPV6] end.`,
  },
  {
    id: "offsets/astral-zwj-combining",
    config: {
      rules: { ipv4: { action: "mask" }, phone: { action: "redact" } },
    },
    options: REPORT,
    input: `😀 ${IPV4} 👨‍👩‍👧 call ${PHONE} 联系 é 🇯🇵 then 👩🏽‍💻${IPV4}👩🏽‍💻 and ñö ${PHONE} 😀😀😀 end.`,
  },
  {
    id: "offsets/rtl",
    config: NETWORK,
    options: REPORT,
    input: `שלום ${IPV4} עולם, مرحبا ${MAC} شكرا, ‫${IPV4}‬ and ‏198.51.100.7‎ done.`,
  },
  {
    id: "preset/pci-dss",
    config: { presets: ["pci-dss"], rules: {} },
    options: RESTORE,
    input: `Card ${CARD} exp 12/30. Card 5555 5555 5555 4444 declined; retry with ${CARD} later today.`,
  },
  {
    id: "no-matches",
    config: NETWORK,
    options: RESTORE,
    input:
      "Nothing sensitive in this sentence, which is long enough to flush part of the buffer early on.",
  },
  {
    id: "empty-input",
    config: NETWORK,
    options: RESTORE,
    input: "",
  },

  // Whole-input buffering (window wider than the input)
  {
    id: "buffered/email/report",
    config: { rules: { email: { action: "redact" } } },
    options: REPORT,
    input: `Mail ${EMAIL} or ${EMAIL_2} today.`,
  },
  {
    id: "buffered/email/restore",
    config: { rules: { email: { action: "redact" } } },
    options: RESTORE,
    input: `Mail ${EMAIL} or ${EMAIL_2}, again ${EMAIL}.`,
  },
  {
    id: "buffered/url-with-auth/equal-rank-conflict",
    config: {
      rules: {
        url_with_auth: { action: "redact" },
        ipv4: { action: "redact" },
      },
    },
    options: REPORT,
    input: `See https://user:pass@${IPV4}/path and ${IPV4}.`,
  },
  {
    id: "buffered/http-auth-header/custom-headers",
    config: {
      rules: { http_auth_header: { action: "redact" } },
      detectorOptions: {
        http_auth_header: { customHeaders: ["X-Example-Auth"] },
      },
    },
    options: REPORT,
    input:
      "Authorization: Basic dXNlcjpwYXNz\nX-Example-Auth: example-value-1\n",
  },
];
