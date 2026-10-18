/**
 * Fake values shared by the seed files. Every one is a documentation or test
 * value (example.com, RFC 5737/3849 ranges, the 4111 test card, the IBAN
 * registry example) and must stay safe for secret scanners.
 */
export const EMAIL = "jane.doe@example.com";
export const EMAIL_2 = "john@example.org";
export const CARD = "4111 1111 1111 1111";
export const CARD_DASHED = "4111-1111-1111-1111";
export const IPV4 = "192.0.2.10";
export const IPV6 = "2001:db8::1";
export const MAC = "00:00:5e:00:53:af";
export const PHONE = "+1 555 010 0199";
export const IBAN = "GB82 WEST 1234 5698 7654 32";
export const SSN = "123-45-6789";

/** `url_with_auth` around an `ipv4`: the canonical overlap pair. */
export const URL_WITH_IP = `https://user:pass@${IPV4}/path`;

/** Base64 of `user:pass`. */
export const BASIC_AUTH = "Authorization: Basic dXNlcjpwYXNz";

/** Matches `private_key` without containing key material. */
export const PRIVATE_KEY =
  "-----BEGIN PRIVATE KEY-----\nNOT A REAL KEY, TEST FIXTURE ONLY\n-----END PRIVATE KEY-----";
