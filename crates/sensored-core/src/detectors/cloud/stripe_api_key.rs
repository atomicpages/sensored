//! Mirrors `detectors/cloud/stripe-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "stripe_api_key",
        entity_type: "stripe_api_key",
        replacement: "[STRIPE_API_KEY]",
        pattern: LazyLock::new(|| regex(r"(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}")),
        validate: |_| Some(&["stripe_api_key.format"]),
        stream: StreamMeta::new(128, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::assert_cases;
    use super::*;

    /// From `test/stripe-api-key.test.ts`.
    #[test]
    fn detects_keys() {
        let found = [
            (
                "sk_live_1234567890abcdefghijklmnopqrstuv",
                "sk_live_1234567890abcdefghijklmnopqrstuv",
            ),
            (
                "Key pk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456.",
                "pk_test_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
            ),
        ];
        let rejected = [
            "sk_prod_1234567890abcdefghijklmnopqrstuv",
            "sk_live_1234567890abcdefghij",
            "foosk_live_1234567890abcdefghijklmnopqrstuvbar",
            "sk_live_1234567890abcdefghijklmnopqrstuv_",
        ];

        assert_cases(&detector(), &found, &rejected);
    }
}
