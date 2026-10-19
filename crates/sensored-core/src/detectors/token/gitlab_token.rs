//! GitLab personal access tokens. Mirrors `token/gitlab-token.ts`.

use std::sync::LazyLock;

use super::regex;
use crate::detector::{ChecksumDetector, StreamMeta};

pub(super) fn detector() -> ChecksumDetector {
    ChecksumDetector {
        id: "gitlab_token",
        entity_type: "gitlab_token",
        replacement: "[GITLAB_TOKEN]",
        pattern: LazyLock::new(|| regex(r"glpat-[a-zA-Z0-9\-=_]{20,22}")),
        validate: |_| Some(&["gitlab_token.format"]),
        stream: StreamMeta::new(30, 0, 0),
    }
}
