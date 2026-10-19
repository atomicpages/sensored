//! Mirrors `detectors/cloud/digitalocean-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "digitalocean_token",
        entity_type: "digitalocean_token",
        replacement: "[DIGITALOCEAN_TOKEN]",
        pattern: LazyLock::new(|| regex(r"(?:dop_v1_|doo_v1_|dor_v1_)[a-f0-9]{64}")),
        validate: |_| Some(&["digitalocean_token.format"]),
        stream: StreamMeta::new(71, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::assert_cases;
    use super::*;

    /// From `test/digitalocean-token.ts`.
    #[test]
    fn detects_keys() {
        let found = [
            (
                "dop_v1_0000000000000000000000000000000000000000000000000000000000000000",
                "dop_v1_0000000000000000000000000000000000000000000000000000000000000000",
            ),
            (
                "t dor_v1_abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd.",
                "dor_v1_abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            ),
        ];
        let rejected = [
            "dop_v1_00000000000000000000000000000000000000000000000000000000000000",
            "dop_v1_ABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD",
            "dop_v1_00000000000000000000000000000000000000000000000000000000000000000",
            "dox_v1_0000000000000000000000000000000000000000000000000000000000000000",
        ];

        assert_cases(&detector(), &found, &rejected);
    }
}
