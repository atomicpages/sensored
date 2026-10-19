//! Mirrors `detectors/cloud/google-api-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "google_api_key",
        entity_type: "google_api_key",
        replacement: "[GOOGLE_API_KEY]",
        pattern: LazyLock::new(|| regex(r"AIza[0-9A-Za-z_-]{35}")),
        validate: |_| Some(&["google_api_key.format"]),
        stream: StreamMeta::new(39, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::assert_cases;
    use super::*;

    /// From `test/google-api-key.test.ts`.
    #[test]
    fn detects_keys() {
        let found = [
            (
                "AIzaSyA1234567890abcdefghijklmnopqrstuv",
                "AIzaSyA1234567890abcdefghijklmnopqrstuv",
            ),
            (
                "Key AIzaSyD-1234567890abcdefghijklmnopqrstu.",
                "AIzaSyD-1234567890abcdefghijklmnopqrstu",
            ),
        ];
        let rejected = [
            "aizaSyA1234567890abcdefghijklmnopqrstuvw",
            "AIzaSyA1234567890abcdefghijklmnopqrstu",
            "fooAIzaSyA1234567890abcdefghijklmnopqrstuvbar",
            "_AIzaSyA1234567890abcdefghijklmnopqrstuv",
            "AIzaSyA1234567890abcdefghijklmnopqrstuv_",
        ];

        assert_cases(&detector(), &found, &rejected);
    }
}
