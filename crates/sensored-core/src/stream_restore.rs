//! Mirrors `stream-restore.ts`. Owner: phase 1 agent (c).

use crate::types::RestorationMap;

/// Restores placeholders across chunk boundaries, holding back a tail only
/// while it is a proper prefix of a placeholder in the map.
pub struct StreamRestorer {
    map: RestorationMap,
    held: String,
}

impl StreamRestorer {
    pub fn new(map: RestorationMap) -> Self {
        Self {
            map,
            held: String::new(),
        }
    }

    pub fn push(&mut self, chunk: &str) -> String {
        let _ = (chunk, &self.map, &self.held);
        todo!("phase 1 agent (c)")
    }

    pub fn flush(&mut self) -> String {
        todo!("phase 1 agent (c)")
    }
}
