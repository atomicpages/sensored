//! Mirrors `detectors/network/mac-address.ts`.

use std::sync::LazyLock;

use regex::Regex;

use super::{format_detection, regex};
use crate::detector::{Detector, Input, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "mac_address";

static COLON: LazyLock<Regex> = LazyLock::new(|| regex("(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"));
static HYPHEN: LazyLock<Regex> = LazyLock::new(|| regex("(?:[0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}"));

pub struct MacAddressDetector;

impl Detector for MacAddressDetector {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[MAC_ADDRESS]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(17, 0, 0))
    }

    /// Colon matches first, then hyphen matches, as TS loops the patterns.
    fn detect_in(&self, input: &Input<'_>, out: &mut Vec<Detection>) {
        let text = input.text();

        let mut candidates = Vec::new();

        for (pattern, separator) in [(&COLON, b':'), (&HYPHEN, b'-')] {
            for found in pattern.find_iter(text) {
                let (start, end) = (found.start(), found.end());

                if is_adjacent_forbidden(text, start, end) || continues(text, end, separator) {
                    continue;
                }

                candidates.push(format_detection(ID, start, end));
            }
        }

        push_aligned(text, candidates, out);
    }
}

/// Whether the same separator and a hex digit follow (a seventh group).
/// Both are ASCII, so bytes compare like the TS UTF-16 units.
fn continues(text: &str, end: usize, separator: u8) -> bool {
    match text.as_bytes().get(end..end + 2) {
        Some(&[next, after]) => next == separator && after.is_ascii_hexdigit(),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::values;
    use super::*;

    /// From `test/mac-address.test.ts`.
    #[test]
    fn detects_addresses() {
        let cases = [
            ("00:1A:2B:3C:4D:5E", "00:1A:2B:3C:4D:5E"),
            ("00-1A-2B-3C-4D-5E", "00-1A-2B-3C-4D-5E"),
            ("01:23:45:67:89:ab", "01:23:45:67:89:ab"),
            ("00:1A:2b:3C:4d:5E", "00:1A:2b:3C:4d:5E"),
            ("Device 00:1A:2B:3C:4D:5E online", "00:1A:2B:3C:4D:5E"),
            ("MAC 00:1A:2B:3C:4D:5E.", "00:1A:2B:3C:4D:5E"),
            // A separator without a hex digit after it does not extend it.
            ("00:1A:2B:3C:4D:5E:", "00:1A:2B:3C:4D:5E"),
            ("00:1A:2B:3C:4D:5E-6F", "00:1A:2B:3C:4D:5E"),
        ];

        for (input, expected) in cases {
            assert_eq!(values(&MacAddressDetector, input), [expected], "{input}");
        }
    }

    /// From `test/mac-address.test.ts`.
    #[test]
    fn rejects_malformed_or_embedded_addresses() {
        let cases = [
            "00:1A:2B:3C:4D",
            "00:1A:2B:3C:4D:5E:6F",
            "00-1A-2B-3C-4D-5E-6F",
            "00:1A-2B:3C-4D:5E",
            "foo00:1A:2B:3C:4D:5Ebar",
            "_00:1A:2B:3C:4D:5E",
            "00:1A:2B:3C:4D:5E_",
        ];

        for input in cases {
            assert!(values(&MacAddressDetector, input).is_empty(), "{input}");
        }
    }

    #[test]
    fn colon_matches_come_first() {
        assert_eq!(
            values(&MacAddressDetector, "00-1A-2B-3C-4D-5E 00:1A:2B:3C:4D:5E"),
            ["00:1A:2B:3C:4D:5E", "00-1A-2B-3C-4D-5E"]
        );
    }
}
