//! Shopify API tokens. Mirrors `token/shopify-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "shopify_token",
        entity_type: "shopify_token",
        replacement: "[SHOPIFY_TOKEN]",
        pattern: LazyLock::new(|| {
            regex(r"(?:shppa_|shpat_|shpca_)[0-9A-Fa-f]{32,38}|shpss_[a-fA-F0-9]{32,38}")
        }),
        validate: |_| Some(&["shopify_token.format"]),
        stream: StreamMeta::new(44, 0, 0),
    }
}
