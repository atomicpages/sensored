//! Mirrors `stream-restore.ts`.

use crate::restore::restore;
use crate::types::RestorationMap;

/// Restores placeholders across chunk boundaries, holding back a tail only
/// while it is a proper prefix of a placeholder in the map.
pub struct StreamRestorer {
    map: RestorationMap,
    /// The map's keys in byte order, so keys sharing a prefix are contiguous
    /// and the hold-back check is a binary search, not a scan of the map.
    sorted_keys: Vec<String>,
    held: String,
}

impl StreamRestorer {
    pub fn new(map: RestorationMap) -> Self {
        let mut sorted_keys: Vec<String> = map.keys().cloned().collect();
        sorted_keys.sort_unstable();

        Self {
            map,
            sorted_keys,
            held: String::new(),
        }
    }

    pub fn push(&mut self, chunk: &str) -> String {
        let mut text = std::mem::take(&mut self.held);
        text.push_str(chunk);

        // Hold back only a tail that can still grow into a placeholder in the
        // map; anything else would pass through `restore` unchanged anyway.
        if let Some(open) = text.rfind('[') {
            if self.is_partial_placeholder(&text[open..]) {
                self.held = text.split_off(open);

                return restore(&text, &self.map);
            }
        }

        restore(&text, &self.map)
    }

    pub fn flush(&mut self) -> String {
        restore(&std::mem::take(&mut self.held), &self.map)
    }

    /// Whether some key starts with `tail` and is longer than it.
    fn is_partial_placeholder(&self, tail: &str) -> bool {
        let first = self.sorted_keys.partition_point(|key| key.as_str() < tail);

        // Keys are unique, so at most the first candidate equals `tail`.
        self.sorted_keys[first..]
            .iter()
            .take(2)
            .any(|key| key.len() > tail.len() && key.starts_with(tail))
    }
}
