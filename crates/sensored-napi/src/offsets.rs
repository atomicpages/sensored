//! Offset conversion between the core's UTF-8 bytes and JS UTF-16 units.
//!
//! The core converters walk the text once but need sorted offsets, while a
//! call's offsets (group and match bounds) are not sorted. `OffsetMap` sorts
//! and dedups them, converts in one pass, then answers lookups.

use sensored_core::text::{utf8_to_utf16, utf16_to_utf8};

pub struct OffsetMap {
    from: Vec<usize>,
    to: Vec<usize>,
}

impl OffsetMap {
    /// Byte offsets (all on char boundaries of `text`) to UTF-16 units.
    pub fn utf8_to_utf16(text: &str, offsets: impl IntoIterator<Item = usize>) -> Self {
        let from = sorted_unique(offsets);
        let mut to = from.clone();

        if !to.is_empty() && !text.is_ascii() {
            utf8_to_utf16(text, &mut to);
        }

        Self { from, to }
    }

    /// UTF-16 units to byte offsets. `None` when an offset is out of bounds
    /// or splits a surrogate pair.
    pub fn utf16_to_utf8(text: &str, offsets: impl IntoIterator<Item = usize>) -> Option<Self> {
        let from = sorted_unique(offsets);
        let mut to = from.clone();

        if text.is_ascii() {
            if to.last().is_some_and(|&last| last > text.len()) {
                return None;
            }
        } else {
            utf16_to_utf8(text, &mut to)?;
        }

        Some(Self { from, to })
    }

    /// Looks up an offset that was passed to the constructor.
    pub fn get(&self, offset: usize) -> usize {
        let index = self
            .from
            .binary_search(&offset)
            .expect("offset was registered with the map");

        self.to[index]
    }
}

fn sorted_unique(offsets: impl IntoIterator<Item = usize>) -> Vec<usize> {
    let mut sorted: Vec<usize> = offsets.into_iter().collect();

    sorted.sort_unstable();
    sorted.dedup();

    sorted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_unsorted_offsets_both_ways() {
        let text = "a😀b€c";
        let bytes = OffsetMap::utf8_to_utf16(text, [6, 0, 1, 5]);

        assert_eq!(
            [0, 1, 5, 6].map(|o| bytes.get(o)),
            [0, 1, 3, 4],
            "emoji is 4 bytes and 2 units"
        );

        let units = OffsetMap::utf16_to_utf8(text, [4, 1, 3]).expect("valid offsets");

        assert_eq!([1, 3, 4].map(|o| units.get(o)), [1, 5, 6]);
    }

    #[test]
    fn rejects_split_surrogates_and_out_of_bounds() {
        assert!(OffsetMap::utf16_to_utf8("a😀", [2]).is_none());
        assert!(OffsetMap::utf16_to_utf8("a😀", [4]).is_none());
        assert!(OffsetMap::utf16_to_utf8("abc", [4]).is_none());
        assert!(OffsetMap::utf16_to_utf8("abc", [3]).is_some());
    }
}
