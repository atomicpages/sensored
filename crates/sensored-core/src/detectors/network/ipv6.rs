//! Mirrors `detectors/network/ipv6.ts`.
//!
//! The TS `detect` is the checksum pipeline (match, adjacency, `isValid`), so
//! this is a `ChecksumDetector`. The pattern has no lookaround; the `regex`
//! crate's leftmost-first alternation picks the same match as JS.

use std::sync::LazyLock;

use regex::Regex;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

const GROUP: &str = "[0-9a-fA-F]{1,4}";

fn pattern() -> Regex {
    // Full form: 8 groups.
    let full = format!("(?:{GROUP}:){{7}}{GROUP}");

    // IPv4-mapped: `::ffff:A.B.C.D`.
    let mapped = r"::[fF]{4}:(?:[0-9]{1,3}\.){3}[0-9]{1,3}";

    // Compressed: optional groups before `::`, `::`, optional groups after.
    let groups = format!("{GROUP}(?::{GROUP})*");
    let compressed = format!("(?:{groups})?::(?:{groups})?");

    regex(&format!("{full}|{mapped}|{compressed}"))
}

static IPV4_TAIL: LazyLock<Regex> = LazyLock::new(|| regex(r"(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"));

/// TS `isValid`. The candidate is ASCII (the pattern has no other characters).
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if candidate == "::" {
        return None;
    }

    let double_colons = candidate.matches("::").count();

    if double_colons > 1 {
        return None;
    }

    // An IPv4-mapped tail counts as two groups.
    let (core, ipv4_groups) = match IPV4_TAIL.find(candidate) {
        Some(tail) => {
            let head = &candidate[..tail.start()];

            (head.strip_suffix(':').unwrap_or(head), 2)
        }
        None => (candidate, 0),
    };

    let mut group_count = ipv4_groups;

    for part in core.split("::").filter(|part| !part.is_empty()) {
        for group in part.split(':') {
            if group.is_empty() || group.len() > 4 {
                return None;
            }

            group_count += 1;
        }
    }

    if double_colons == 0 && group_count != 8 {
        return None;
    }

    if double_colons == 1 && group_count >= 8 {
        return None;
    }

    let lower = candidate.to_ascii_lowercase();

    if lower == "::1" || lower.starts_with("fe80:") {
        return None;
    }

    Some(&["ipv6.format"])
}

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "ipv6",
        entity_type: "ipv6",
        replacement: "[IPV6]",
        pattern: LazyLock::new(pattern),
        validate,
        stream: StreamMeta::new(39, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/ipv6.test.ts`.
    #[test]
    fn detects_addresses() {
        let cases = [
            "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
            "2001:db8:85a3:0:0:8a2e:370:7334",
            "2001:db8:85a3::8a2e:370:7334",
            "2001:db8::1",
            "::ffff:192.0.2.1",
            "::FFFF:8.8.8.8",
            "2a00:1450:4001:80b::200e",
            "2606:4700:4700::1111",
            "fe00::1",
            "2001:db8::",
        ];

        for input in cases {
            assert_eq!(values(&detector(), input), [input], "{input}");
        }
    }

    /// From `test/ipv6.test.ts`.
    #[test]
    fn rejects_excluded_or_embedded_addresses() {
        let cases = [
            "::1",
            "::",
            "fe80::1",
            "fe80::",
            "FE80::1",
            "foo2001:db8::1bar",
            "_2001:db8::1",
            "2001:db8::1_",
            // Seven groups and no `::`.
            "2001:db8:85a3:0:0:8a2e:370",
            // `::` with eight groups.
            "1:2:3:4::5:6:7:8",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn matches_like_js_alternation() {
        // The full form wins over the compressed one at the same start.
        assert_eq!(
            values(&detector(), "1:2:3:4:5:6:7:8::"),
            ["1:2:3:4:5:6:7:8"]
        );

        // A trailing period stays outside the match.
        assert_eq!(values(&detector(), "Server 2001:db8::1."), ["2001:db8::1"]);

        // Five hex digits: the group stops at four and the fifth is adjacent.
        assert!(values(&detector(), "2001:db8::12345").is_empty());

        // A malformed IPv4 tail falls back to the compressed form, then the
        // trailing `.` digits are not adjacent word characters.
        assert_eq!(values(&detector(), "::ffff:1111.2.3.4"), ["::ffff:1111"]);
    }

    #[test]
    fn validate_counts_groups() {
        assert_eq!(validate("::ffff:192.0.2.1"), Some(&["ipv6.format"][..]));
        assert_eq!(validate("1::2::3"), None);
        assert_eq!(validate("1:2:3:4:5:6:7"), None);
    }
}
