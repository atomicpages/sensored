//! Mirrors `detectors/cloud/aws-access-key.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "aws_access_key",
        entity_type: "aws_access_key",
        replacement: "[AWS_ACCESS_KEY]",
        pattern: LazyLock::new(|| regex(r"AKIA[0-9A-Z]{16}")),
        validate: |_| Some(&["aws_access_key.format"]),
        stream: StreamMeta::new(20, 0, 0),
    }
}

#[cfg(test)]
mod tests {
    use super::super::test_support::assert_cases;
    use super::*;

    /// From `test/aws-access-key.test.ts`.
    #[test]
    fn detects_keys() {
        let found = [
            ("AKIAIOSFODNN7EXAMPLE", "AKIAIOSFODNN7EXAMPLE"),
            ("Key AKIA1234567890ABCDEF.", "AKIA1234567890ABCDEF"),
        ];
        let rejected = [
            "akiaIOSFODNN7EXAMPLE",
            "BKIAIOSFODNN7EXAMPLE",
            "AKIAIOSFODNN7EXAMP",
            "AKIAIOSFODNN7EXAMPLEX",
            "fooAKIAIOSFODNN7EXAMPLEbar",
            "_AKIAIOSFODNN7EXAMPLE",
            "AKIAIOSFODNN7EXAMPLE_",
        ];

        assert_cases(&detector(), &found, &rejected);
    }
}
