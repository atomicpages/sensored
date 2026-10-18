//! Mirrors `detectors/cloud/cloudflare-api-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "cloudflare_api_token",
        entity_type: "cloudflare_api_token",
        replacement: "[CLOUDFLARE_API_TOKEN]",
        pattern: LazyLock::new(|| regex(r"(?:cfk_|cfut_|cfat_)[a-zA-Z0-9_-]{20,}")),
        validate: |_| Some(&["cloudflare_api_token.format"]),
        stream: StreamMeta::new(100, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::assert_cases;
    use super::*;

    /// From `test/cloudflare-api-token.ts`.
    #[test]
    fn detects_keys() {
        let found = [
            (
                "cfut_FAKEfake0000000000000000",
                "cfut_FAKEfake0000000000000000",
            ),
            (
                "token cfk_FAKE-fake_0000000000000.",
                "cfk_FAKE-fake_0000000000000",
            ),
        ];
        let rejected = [
            "cfat_short000",
            "cfx_FAKEfake0000000000000000",
            "xcfat_FAKEfake0000000000000000",
            "cfat_FAKEfake0000000000000000é",
        ];

        assert_cases(&detector(), &found, &rejected);
    }
}
