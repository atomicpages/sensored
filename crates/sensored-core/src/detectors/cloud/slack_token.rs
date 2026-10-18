//! Mirrors `detectors/cloud/slack-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "slack_token",
        entity_type: "slack_token",
        replacement: "[SLACK_TOKEN]",
        pattern: LazyLock::new(|| regex(r"xox[baprs]-[0-9a-zA-Z-]{10,}")),
        validate: |_| Some(&["slack_token.format"]),
        stream: StreamMeta::new(128, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::assert_cases;
    use super::*;

    /// From `test/slack-token.test.ts`.
    #[test]
    fn detects_keys() {
        let found = [
            ("xoxb-1234567890-abcdefghij", "xoxb-1234567890-abcdefghij"),
            (
                "xoxs-1234567890123-1234567890123-abcdefghij",
                "xoxs-1234567890123-1234567890123-abcdefghij",
            ),
            (
                "Token: xoxp-1234567890-abcdefghij here",
                "xoxp-1234567890-abcdefghij",
            ),
        ];
        let rejected = [
            "xoxb-123456789",
            "xoxc-1234567890-abcdefghij",
            "fooxoxb-1234567890-abcdefghijbar",
            "_xoxb-1234567890-abcdefghij",
        ];

        assert_cases(&detector(), &found, &rejected);
    }
}
