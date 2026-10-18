//! Mirrors `render/format-preserve.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::grapheme;

static LETTER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{L}").expect("valid pattern"));
static DIGIT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\p{Nd}").expect("valid pattern"));

/// One symbol per grapheme cluster: a cluster with a letter becomes `*`, one
/// with a decimal digit becomes `X`, anything else (separators, punctuation,
/// emoji) is kept.
///
/// Example: `123-45-6789` → `XXX-XX-XXXX`, `josé@example.com` → `****@*******.***`
pub(super) fn render(text: &str, start: usize, end: usize) -> String {
    let mut result = String::with_capacity(end - start);

    for (_, cluster) in grapheme::segments(&text[start..end]) {
        if LETTER.is_match(cluster) {
            result.push('*');
        } else if DIGIT.is_match(cluster) {
            result.push('X');
        } else {
            result.push_str(cluster);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn whole(text: &str) -> String {
        render(text, 0, text.len())
    }

    #[test]
    fn one_symbol_per_cluster() {
        assert_eq!(whole("123-45-6789"), "XXX-XX-XXXX");
        assert_eq!(whole("josé@example.com"), "****@*******.***");
        assert_eq!(whole("e\u{301}1"), "*X");
        assert_eq!(whole("٣😀"), "X😀");
    }
}
