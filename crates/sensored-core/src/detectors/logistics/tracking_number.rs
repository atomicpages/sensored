//! UPS, FedEx, USPS and DHL tracking numbers near a label. Mirrors
//! `logistics/tracking-number.ts`.
//!
//! Candidates are ASCII (the pattern has no `i` flag), so bytes are chars.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{ContextDetector, ContextMatcher, StreamMeta};

const LEFT_CONTEXT: usize = 35;
const RIGHT_CONTEXT: usize = 20;

const LABELS: &str = r"(?:Tracking[- ]?(?:Number|No\.?|ID)|Package[- ]?ID|Shipment[- ]?ID|Waybill[- ]?No\.?|Consignment[- ]?No\.?)";

const PATTERN: &str = r"1Z[A-Z0-9]{16}|[0-9]{20,22}|[0-9]{15}|[0-9]{12}|[0-9]{10}";

fn digit(byte: u8) -> Option<u32> {
    byte.is_ascii_digit().then(|| u32::from(byte - b'0'))
}

/// Digits are their value; uppercase letters are their code minus 48.
fn char_value(byte: u8) -> u32 {
    u32::from(byte) - 48
}

fn ups_valid(candidate: &[u8]) -> bool {
    let chars = &candidate[2..];

    if chars.len() != 16 {
        return false;
    }

    let Some(check) = digit(chars[15]) else {
        return false;
    };

    let sum: u32 = chars[..15]
        .iter()
        .enumerate()
        .map(|(i, &byte)| {
            let weight = if i % 2 == 0 { 3 } else { 1 };
            let product = char_value(byte) * weight;

            product / 10 + product % 10
        })
        .sum();

    (10 - sum % 10) % 10 == check
}

/// Every byte of a numeric candidate is a digit.
fn digits(candidate: &[u8]) -> impl DoubleEndedIterator<Item = u32> + '_ {
    candidate.iter().map(|&byte| u32::from(byte - b'0'))
}

fn fedex_express_valid(candidate: &[u8]) -> bool {
    let sum: u32 = digits(&candidate[..11])
        .zip(1..)
        .map(|(value, weight)| value * weight)
        .sum();

    let check = match sum % 11 {
        10 => 0,
        rest => rest,
    };

    check == u32::from(candidate[11] - b'0')
}

fn mod10_valid(candidate: &[u8]) -> bool {
    let (last, body) = candidate.split_last().expect("non-empty candidate");

    // Weight 3 on the digit next to the check digit, alternating leftwards.
    let sum: u32 = digits(body)
        .rev()
        .zip([3, 1].into_iter().cycle())
        .map(|(value, weight)| value * weight)
        .sum();

    (10 - sum % 10) % 10 == u32::from(last - b'0')
}

fn dhl_valid(candidate: &[u8]) -> bool {
    let number = digits(&candidate[..9]).fold(0, |acc, value| acc * 10 + value);

    number % 7 == u32::from(candidate[9] - b'0')
}

fn validate(candidate: &str) -> Option<&'static [&'static str]> {
    let bytes = candidate.as_bytes();

    if bytes.starts_with(b"1Z") {
        return ups_valid(bytes)
            .then_some(&["tracking_number.ups_checksum", "tracking_number.format"][..]);
    }

    match bytes.len() {
        10 => dhl_valid(bytes)
            .then_some(&["tracking_number.dhl_checksum", "tracking_number.format"][..]),
        12 => fedex_express_valid(bytes).then_some(
            &[
                "tracking_number.fedex_express_checksum",
                "tracking_number.format",
            ][..],
        ),
        15 => mod10_valid(bytes).then_some(
            &[
                "tracking_number.fedex_ground_checksum",
                "tracking_number.format",
            ][..],
        ),
        20..=22 => mod10_valid(bytes)
            .then_some(&["tracking_number.usps_checksum", "tracking_number.format"][..]),
        _ => None,
    }
}

pub fn detector() -> ContextDetector {
    ContextDetector {
        id: "tracking_number",
        entity_type: "tracking_number",
        replacement: "[TRACKING_NUMBER]",
        pattern: LazyLock::new(|| Regex::new(PATTERN).expect("valid pattern")),
        context: LazyLock::new(|| ContextMatcher::new(LABELS, LEFT_CONTEXT, RIGHT_CONTEXT)),
        labels: &[
            "Tracking Number",
            "Tracking No.",
            "Tracking No",
            "Tracking ID",
            "Package ID",
            "Shipment ID",
            "Waybill No.",
            "Waybill No",
            "Consignment No.",
            "Consignment No",
        ],
        window: (LEFT_CONTEXT, RIGHT_CONTEXT),
        validate: Some(validate),
        stream: StreamMeta::new(22, LEFT_CONTEXT, RIGHT_CONTEXT),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detector::Detector;
    use crate::detectors::identity::test_support::{spans, values};

    #[test]
    fn matches_each_carrier_with_a_label() {
        let detector = detector();
        let cases = [
            ("Tracking No.: 1Z999AA10123456788", "1Z999AA10123456788"),
            (
                "Package ID: 9400111899223100123457",
                "9400111899223100123457",
            ),
            ("Waybill No.: 1234567891", "1234567891"),
            ("Consignment No.: 123456789012343", "123456789012343"),
            ("Package-ID: 123456789010", "123456789010"),
            ("Tracking Number:\t1234567891", "1234567891"),
            ("1234567891 (Tracking Number)", "1234567891"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&detector, text), [value], "{text}");
        }
    }

    #[test]
    fn rejects_invalid_or_unlabelled_candidates() {
        let detector = detector();
        let cases = [
            "1234567891",
            "Reference: 1234567891",
            "Tracking Number: 1Z999AA10123456789",
            "Tracking Number: 123456789011",
            "Tracking Number: 123456789012349",
            "Tracking Number: 9400111899223100123459",
            "Tracking Number: 1234567890",
            "myTracking Number: 1234567891",
            "Tracking Number:\n1234567891",
            "1234567891 (Tracking Number",
            "Tracking Number: 1234567891_",
            "Tracking  Number: 1234567891",
            "Tracking Number: 12345678912",
            "Tracking Number: 1234567891234",
        ];

        for text in cases {
            assert!(spans(&detector, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn reasons_name_the_carrier() {
        let mut out = Vec::new();
        detector().detect("Tracking Number: 1234567891", &mut out);

        assert_eq!(
            out[0].reasons,
            [
                "tracking_number.dhl_checksum",
                "tracking_number.format",
                "tracking_number.context"
            ]
        );
        assert_eq!((out[0].start, out[0].end), (17, 27));
    }
}
