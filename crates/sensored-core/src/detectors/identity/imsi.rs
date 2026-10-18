//! International mobile subscriber identities near a label. Mirrors
//! `identity/imsi.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::checksum::luhn_valid;
use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LABELS: &str = "(?:IMSI|Subscriber[- ]?ID|Subscriber[- ]?Number|Mobile[- ]?Subscriber)";
const WINDOW: (usize, usize) = (35, 20);

fn all_same_digit(candidate: &str) -> bool {
    let bytes = candidate.as_bytes();

    !bytes.is_empty() && bytes.iter().all(|&byte| byte == bytes[0])
}

/// A Luhn-valid number is rejected: it is more likely an IMEI.
fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    if all_same_digit(candidate) || luhn_valid(candidate) {
        return None;
    }

    Some(&["imsi.format"])
}

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "imsi",
        entity_type: "imsi",
        replacement: "[IMSI]",
        pattern: LazyLock::new(|| Regex::new(r"[0-9]{15}").expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, WINDOW.0, WINDOW.1)),
        labels: &[
            "IMSI",
            "Subscriber ID",
            "Subscriber Number",
            "Mobile Subscriber",
        ],
        window: WINDOW,
        validate: Some(validate),
        stream: StreamMeta::new(15, WINDOW.0, WINDOW.1),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    /// From `test/imsi.test.ts`.
    #[test]
    fn detects_labelled_imsis() {
        let cases = [
            "IMSI: 310260123456789",
            "Subscriber-ID: 310260123456789",
            "SubscriberID: 310260123456789",
            "Mobile-Subscriber: 310260123456789",
            "imsi: 310260123456789",
            "IMSI# 310260123456789",
            "IMSI:\t310260123456789",
            "(IMSI: 310260123456789)",
            "310260123456789 (IMSI)",
            "310260123456789\t(IMSI)",
        ];

        for text in cases {
            assert_eq!(values(&detector(), text), ["310260123456789"], "{text}");
        }

        assert_eq!(
            spans(
                &detector(),
                "IMSI: 310260123456789 and IMSI: 445670123456789"
            ),
            [(6, 21), (32, 47)]
        );
    }

    /// From `test/imsi.test.ts`.
    #[test]
    fn rejects_invalid_or_unlabelled() {
        let cases = [
            "310260123456789",
            "Phone: 310260123456789",
            "IMSI: 111111111111111",
            "IMSI: 310260000000005",
            "IMSI: 12345678901234",
            "IMSI: 1234567890123456",
            "myIMSI: 310260123456789",
            "IMSIx: 310260123456789",
            "IMSI: [IMSI]",
        ];

        for text in cases {
            assert!(spans(&detector(), text).is_empty(), "{text}");
        }
    }
}
