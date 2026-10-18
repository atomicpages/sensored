//! Mirrors `detectors/network/ipv4.ts`.
//!
//! The TS `detect` is the checksum pipeline (match, adjacency, exclusion
//! check), so this is a `ChecksumDetector`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

const OCTET: &str = "(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";

/// TS `isExcluded`, inverted: rejects unspecified, broadcast, private and
/// loopback addresses. The pattern guarantees four decimal octets.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let mut octets = candidate
        .split('.')
        .map(|part| part.parse::<u8>().unwrap_or(0));
    let a = octets.next().unwrap_or(0);
    let b = octets.next().unwrap_or(0);

    let excluded = candidate == "0.0.0.0"
        || candidate == "255.255.255.255"
        || a == 10
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && b == 168)
        || a == 127;

    if excluded {
        return None;
    }

    Some(&["ipv4.format"])
}

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "ipv4",
        entity_type: "ipv4",
        replacement: "[IPV4]",
        pattern: LazyLock::new(|| regex(&format!("{OCTET}\\.{OCTET}\\.{OCTET}\\.{OCTET}"))),
        validate,
        stream: StreamMeta::new(15, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/ipv4.test.ts`.
    #[test]
    fn detects_public_addresses() {
        let cases = [
            ("8.8.8.8", "8.8.8.8"),
            ("Server 1.2.3.4.", "1.2.3.4"),
            ("203.0.113.255 up", "203.0.113.255"),
            ("172.32.0.1", "172.32.0.1"),
            ("172.15.0.1", "172.15.0.1"),
            ("192.169.0.1", "192.169.0.1"),
            // `.` is not a word character, so a fifth group does not stop it.
            ("1.2.3.4.5", "1.2.3.4"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&detector(), input), [expected], "{input}");
        }
    }

    #[test]
    fn rejects_excluded_or_embedded_addresses() {
        let cases = [
            "0.0.0.0",
            "255.255.255.255",
            "10.1.2.3",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.1.1",
            "127.0.0.1",
            "_8.8.8.8",
            "8.8.8.8_",
            "a8.8.8.8",
            // Backtracks to `56.1.1.1`, which a digit precedes.
            "256.1.1.1",
        ];

        for input in cases {
            assert!(values(&detector(), input).is_empty(), "{input}");
        }
    }

    #[test]
    fn longest_octet_wins_before_a_boundary() {
        // `256` is no octet: the match ends at `25`, and the `6` after it is
        // adjacent, so the candidate is rejected (as in TS).
        assert!(values(&detector(), "8.8.8.256").is_empty());
        assert_eq!(values(&detector(), "8.8.8.25 x"), ["8.8.8.25"]);
    }
}
