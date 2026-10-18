//! UTF-16 measurement over UTF-8 text.
//!
//! The TS reference measures every window, limit and stream bound in UTF-16
//! code units. The core keeps those units so results match byte for byte:
//! offsets are UTF-8 bytes, lengths and windows are UTF-16 units.
//!
//! Where a JS slice would split a surrogate pair, these helpers drop the
//! partial character instead; a lone surrogate never changes a match.

/// Length of `text` in UTF-16 code units.
pub fn utf16_len(text: &str) -> usize {
    text.chars().map(char::len_utf16).sum()
}

/// The longest suffix of `text[..end]` that is at most `units` UTF-16 units.
/// Mirrors `text.slice(Math.max(0, end - units), end)`.
pub fn window_before(text: &str, end: usize, units: usize) -> &str {
    let mut start = end;
    let mut used = 0;

    for ch in text[..end].chars().rev() {
        used += ch.len_utf16();

        if used > units {
            break;
        }

        start -= ch.len_utf8();
    }

    &text[start..end]
}

/// The longest prefix of `text[start..]` that is at most `units` UTF-16 units.
/// Mirrors `text.slice(start, start + units)`.
pub fn window_after(text: &str, start: usize, units: usize) -> &str {
    let mut end = start;
    let mut used = 0;

    for ch in text[start..].chars() {
        used += ch.len_utf16();

        if used > units {
            break;
        }

        end += ch.len_utf8();
    }

    &text[start..end]
}

/// Converts sorted UTF-8 byte offsets to UTF-16 offsets in place, in one pass.
///
/// Offsets must be ascending and on char boundaries; the engine only produces
/// such offsets.
pub fn utf8_to_utf16(text: &str, offsets: &mut [usize]) {
    debug_assert!(offsets.windows(2).all(|w| w[0] <= w[1]));
    debug_assert!(offsets.iter().all(|&o| text.is_char_boundary(o)));

    let (mut byte, mut unit, mut i) = (0, 0, 0);

    for ch in text.chars() {
        while i < offsets.len() && offsets[i] == byte {
            offsets[i] = unit;
            i += 1;
        }

        byte += ch.len_utf8();
        unit += ch.len_utf16();
    }

    for offset in &mut offsets[i..] {
        *offset = unit;
    }
}

/// Converts sorted UTF-16 offsets to UTF-8 byte offsets in place, in one pass.
///
/// Returns `None` if an offset falls inside a surrogate pair or past the end:
/// such offsets come from a caller (a JS detector) and are a contract error.
pub fn utf16_to_utf8(text: &str, offsets: &mut [usize]) -> Option<()> {
    debug_assert!(offsets.windows(2).all(|w| w[0] <= w[1]));

    let (mut byte, mut unit, mut i) = (0, 0, 0);

    for ch in text.chars() {
        while i < offsets.len() && offsets[i] <= unit {
            if offsets[i] != unit {
                return None;
            }

            offsets[i] = byte;
            i += 1;
        }

        byte += ch.len_utf8();
        unit += ch.len_utf16();
    }

    for offset in &mut offsets[i..] {
        if *offset != unit {
            return None;
        }

        *offset = byte;
    }

    Some(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_count_utf16_units() {
        let text = "a😀b"; // 😀 is 2 UTF-16 units, 4 bytes
        let end = text.len();

        assert_eq!(window_before(text, end, 1), "b");
        assert_eq!(window_before(text, end, 2), "b"); // would split the pair
        assert_eq!(window_before(text, end, 3), "😀b");
        assert_eq!(window_after(text, 0, 2), "a");
        assert_eq!(window_after(text, 0, 3), "a😀");
    }

    #[test]
    fn offsets_round_trip() {
        let text = "é😀x";
        let mut offsets = [0, 2, 6, 7];

        utf8_to_utf16(text, &mut offsets);
        assert_eq!(offsets, [0, 1, 3, 4]);

        assert!(utf16_to_utf8(text, &mut offsets).is_some());
        assert_eq!(offsets, [0, 2, 6, 7]);
    }

    #[test]
    fn utf16_offset_inside_pair_is_rejected() {
        let mut offsets = [2];

        assert!(utf16_to_utf8("a😀", &mut offsets).is_none());
    }
}
