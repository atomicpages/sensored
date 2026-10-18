//! Mirrors `detectors/contact/email.ts`.
//!
//! The TS detector expands outward from each `@` one character at a time and
//! then checks the local part and domain against ASCII grammars. Both
//! grammars reject any non-ASCII character, so the expansion here takes ASCII
//! bytes only and rejects the candidate outright when it would take a
//! non-ASCII character. Every length TS measures in UTF-16 units is then a
//! byte length too.

use std::sync::LazyLock;

use regex::Regex;

use super::detection;
use crate::detector::{Detector, StreamMeta, push_aligned};
use crate::types::Detection;

const ID: &str = "email";
const REASONS: &[&str] = &["email.ascii_dot_atom", "email.dns_domain"];

/// Longest local part.
const MAX_LOCAL: usize = 64;

/// Longest address, and how far right of the `@` the domain expansion reads.
const MAX_ADDRESS: usize = 254;

const fn ascii_set(extra: &[u8]) -> [bool; 128] {
    let mut set = [false; 128];
    let mut byte = 0;

    while byte < 128 {
        set[byte] = (byte as u8).is_ascii_alphanumeric();
        byte += 1;
    }

    let mut i = 0;

    while i < extra.len() {
        set[extra[i] as usize] = true;
        i += 1;
    }

    set
}

/// ASCII characters that may join a candidate left of the `@` (`leftCharacter`).
/// URL query and path delimiters (`/ ? = &`) end a candidate instead.
static LEFT: [bool; 128] = ascii_set(b".!#$%'*+-^_`{|}~@");

/// ASCII characters that may join a candidate right of the `@` (`rightCharacter`).
static RIGHT: [bool; 128] = ascii_set(b"._@-");

/// `atext`: the `localGrammar` alphabet without the dot.
static ATEXT: [bool; 128] = ascii_set(b"!#$%&'*+-/=?^_`{|}~");

/// Non-ASCII characters both sides accept: letters, marks and numbers, minus
/// scripts written without spaces, which end a candidate rather than poison it.
static WORD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[[\p{L}\p{M}\p{N}]--[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Thai}]]$")
        .expect("valid pattern")
});

/// A quoted local part (`"…"@`). JS `.` excludes line terminators.
static QUOTED_LOCAL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#""(?:[^"\\]|\\[^\n\r\x{2028}\x{2029}])*"@"#).expect("valid pattern")
});

pub struct EmailDetector;

impl Detector for EmailDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[EMAIL]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(MAX_ADDRESS, 0, 0))
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        if !text.contains('@') {
            return;
        }

        // Pre-scan for quoted local parts so `@` signs inside them are skipped.
        let quoted: Vec<(usize, usize)> = QUOTED_LOCAL
            .find_iter(text)
            .map(|found| (found.start(), found.end()))
            .collect();

        let mut quoted_index = 0;
        let mut credentials = CredentialScan::default();
        let mut candidates = Vec::new();

        for (at, _) in text.match_indices('@') {
            // Advance past quoted spans that end before this `@`.
            while quoted.get(quoted_index).is_some_and(|&(_, end)| end <= at) {
                quoted_index += 1;
            }

            let in_quotes = quoted
                .get(quoted_index)
                .is_some_and(|&(start, end)| start < at && at < end);

            if in_quotes || credentials.is_credential_separator(text, at) {
                continue;
            }

            if let Some((start, end)) = candidate(text, at) {
                candidates.push(detection(ID, start, end, REASONS));
            }
        }

        push_aligned(text, candidates, out);
    }
}

/// The address around the `@` at `at`, if it passes both grammars.
fn candidate(text: &str, at: usize) -> Option<(usize, usize)> {
    let bytes = text.as_bytes();
    let start = local_start(text, at)?;
    let mut end = domain_end(text, at)?;

    // A single terminal period is prose punctuation, not a domain suffix.
    let ends_sentence = bytes[end - 1] == b'.'
        && bytes[end - 2] != b'.'
        && text[end..].chars().next().is_none_or(is_js_space);

    if ends_sentence {
        end -= 1;
    }

    let rejected = end - start > MAX_ADDRESS
        || (start > 0 && bytes[start - 1] == b'"')
        || !is_dot_atom(&bytes[start..at])
        || !is_dns_domain(&bytes[at + 1..end]);

    (!rejected).then_some((start, end))
}

enum Step {
    Take,
    Stop,
    Reject,
}

fn step(ch: char, ascii: &[bool; 128]) -> Step {
    if ch.is_ascii() {
        return if ascii[ch as usize] {
            Step::Take
        } else {
            Step::Stop
        };
    }

    let mut buffer = [0; 4];

    if WORD.is_match(ch.encode_utf8(&mut buffer)) {
        Step::Reject
    } else {
        Step::Stop
    }
}

/// Expands left from the `@`. `None` once the local part is too long to pass.
fn local_start(text: &str, at: usize) -> Option<usize> {
    let mut start = at;

    while let Some(ch) = text[..start].chars().next_back() {
        match step(ch, &LEFT) {
            Step::Take => start -= 1,
            Step::Stop => break,
            Step::Reject => return None,
        }

        if at - start > MAX_LOCAL {
            return None;
        }
    }

    Some(start)
}

/// Expands right from the `@`, reading at most `MAX_ADDRESS` past it.
fn domain_end(text: &str, at: usize) -> Option<usize> {
    let mut end = at + 1;

    while end - at <= MAX_ADDRESS {
        let Some(ch) = text[end..].chars().next() else {
            break;
        };

        match step(ch, &RIGHT) {
            Step::Take => end += 1,
            Step::Stop => break,
            Step::Reject => return None,
        }
    }

    Some(end)
}

/// JS `\s`: Unicode `White_Space` plus U+FEFF, minus U+0085.
fn is_js_space(ch: char) -> bool {
    ch == '\u{feff}' || (ch != '\u{85}' && ch.is_whitespace())
}

fn is_atext(byte: &u8) -> bool {
    ATEXT.get(usize::from(*byte)).copied().unwrap_or(false)
}

/// `localGrammar`: dot-separated runs of `atext`.
fn is_dot_atom(local: &[u8]) -> bool {
    local
        .split(|&byte| byte == b'.')
        .all(|atom| !atom.is_empty() && atom.iter().all(is_atext))
}

/// `domainGrammar`: one or more DNS labels, then an alphabetic TLD.
fn is_dns_domain(domain: &[u8]) -> bool {
    let Some(dot) = domain.iter().rposition(|&byte| byte == b'.') else {
        return false;
    };

    let tld = &domain[dot + 1..];

    (2..=63).contains(&tld.len())
        && tld.iter().all(u8::is_ascii_alphabetic)
        && domain[..dot].split(|&byte| byte == b'.').all(is_dns_label)
}

fn is_dns_label(label: &[u8]) -> bool {
    let (Some(first), Some(last)) = (label.first(), label.last()) else {
        return false;
    };

    label.len() <= 63
        && first.is_ascii_alphanumeric()
        && last.is_ascii_alphanumeric()
        && label
            .iter()
            .all(|&byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

/// Finds `@` signs that separate URL credentials (`https://user:pass@host`):
/// a `:` between the last `://` and the `@`. Mirrors TS's `lastIndexOf` check,
/// but reads the text once across all `@` signs, which arrive in order.
#[derive(Default)]
struct CredentialScan {
    scanned: usize,
    scheme: Option<usize>,
    colon: Option<usize>,
}

impl CredentialScan {
    fn is_credential_separator(&mut self, text: &str, at: usize) -> bool {
        let bytes = text.as_bytes();

        // A `://` can't straddle `at`: that byte is `@`.
        for (offset, _) in text[self.scanned..at].match_indices(':') {
            let colon = self.scanned + offset;

            if bytes[colon + 1..].starts_with(b"//") {
                self.scheme = Some(colon);
            }

            self.colon = Some(colon);
        }

        self.scanned = at;

        match (self.scheme, self.colon) {
            (Some(scheme), Some(colon)) => colon >= scheme + 3,
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::found;
    use super::*;

    fn emails(text: &str) -> Vec<&str> {
        found(&EmailDetector, text)
    }

    #[test]
    fn finds_addresses() {
        for (text, values) in [
            (
                "Email: alice+ops@example.com.",
                &["alice+ops@example.com"][..],
            ),
            (
                "a@b.co and z@host.example.au!",
                &["a@b.co", "z@host.example.au"],
            ),
            ("<alice@example.com>", &["alice@example.com"]),
            ("😀 alice@example.com", &["alice@example.com"]),
            ("mail a@example.com.\u{feff}", &["a@example.com"]),
            ("mail a@example.com.\u{85}", &[]),
        ] {
            assert_eq!(emails(text), values, "{text}");
        }
    }

    #[test]
    fn rejects_invalid_or_embedded_candidates() {
        for text in [
            "a..b@example.com",
            "alice@example",
            "éAlice@example.com",
            "𝒂Alice@example.com",
            "a@example.com𝟙",
            "\"alice\"@example.com",
            "\"hello alice@example.com\"@example.net",
            "\"alice@example.com\"",
            "a@example.com_",
            "a@example.com@x",
            "a@example.com..",
            "a@example.com\u{200d}",
            "a@example.com\u{301}",
            "a@example.c0m",
            "a@-example.com",
            "a@example-.com",
            ".a@example.com",
            "a.@example.com",
        ] {
            assert!(emails(text).is_empty(), "{text}");
        }
    }

    #[test]
    fn length_limits() {
        let local = "a".repeat(64);
        let long_local = "a".repeat(65);
        let label = "b".repeat(63);
        let long_label = "b".repeat(64);

        assert_eq!(emails(&format!("{local}@example.com")).len(), 1);
        assert!(emails(&format!("{long_local}@example.com")).is_empty());
        assert_eq!(emails(&format!("a@{label}.com")).len(), 1);
        assert!(emails(&format!("a@{long_label}.com")).is_empty());

        // 254 in total passes; 255 does not.
        let domain = |len: usize| format!("{}.com", vec!["c".repeat(60); len].join("."));
        let fits = format!("{}@{}", "a".repeat(254 - 1 - domain(4).len()), domain(4));
        let over = format!("a{fits}");

        assert_eq!(fits.len(), 254);
        assert_eq!(emails(&fits), [fits.as_str()]);
        assert!(emails(&over).is_empty());
    }

    #[test]
    fn url_delimiters_end_a_candidate() {
        for (text, value) in [
            (
                "https://example.com/?email=jane@example.com",
                "jane@example.com",
            ),
            ("/users/jane@example.com/profile", "jane@example.com"),
            ("?a=1&to=jane@example.com", "jane@example.com"),
        ] {
            assert_eq!(emails(text), [value], "{text}");
        }
    }

    #[test]
    fn url_credentials_are_skipped() {
        assert!(emails("https://user:secret@example.com/path").is_empty());
        assert_eq!(
            emails("https://example.com and jane@example.com"),
            ["jane@example.com"]
        );
        assert_eq!(
            emails("ftp://a:b@host.com then ftp://x/ jane@example.com"),
            ["jane@example.com"]
        );
    }

    #[test]
    fn unspaced_scripts_end_a_candidate() {
        assert_eq!(
            emails("联系jane.doe@example.com谢谢"),
            ["jane.doe@example.com"]
        );
        assert_eq!(emails("メールjane@example.comまで"), ["jane@example.com"]);
        assert_eq!(emails("ติดต่อjane@example.comครับ"), ["jane@example.com"]);
    }

    #[test]
    fn offsets_are_bytes() {
        let mut out = Vec::new();
        EmailDetector.detect("😀 alice@example.com and bob@example.com", &mut out);

        let spans: Vec<_> = out.iter().map(|d| (d.start, d.end)).collect();

        assert_eq!(spans, [(5, 22), (27, 42)]);
        assert_eq!(out[0].reasons, REASONS);
    }
}
