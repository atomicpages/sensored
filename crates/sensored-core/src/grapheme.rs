//! Grapheme cluster helpers. Mirrors `packages/sensored/src/grapheme.ts`.

use unicode_segmentation::{GraphemeCursor, UnicodeSegmentation};

/// Whether byte offset `position` falls on a grapheme cluster boundary.
///
/// Parity quirk: like the TS fast path, a position between two ASCII bytes is
/// always a boundary, even inside `\r\n`.
pub fn is_boundary(text: &str, position: usize) -> bool {
    if position == 0 || position == text.len() {
        return true;
    }

    if position > text.len() || !text.is_char_boundary(position) {
        return false;
    }

    let bytes = text.as_bytes();

    if bytes[position - 1].is_ascii() && bytes[position].is_ascii() {
        return true;
    }

    GraphemeCursor::new(position, text.len(), true)
        .is_boundary(text, 0)
        .unwrap_or(false)
}

/// Grapheme clusters of `text` with their byte offsets.
pub fn segments(text: &str) -> impl Iterator<Item = (usize, &str)> {
    text.grapheme_indices(true)
}

/// Number of grapheme clusters in `text`.
pub fn count(text: &str) -> usize {
    text.graphemes(true).count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boundaries() {
        let family = "👨‍👩‍👧";
        let text = format!("a{family}b");

        assert!(is_boundary(&text, 1));
        assert!(!is_boundary(&text, 5));
        assert!(is_boundary(&text, 1 + family.len()));
        assert!(is_boundary("\r\n", 1)); // parity quirk
        assert!(!is_boundary("e\u{301}", 1));
    }
}
