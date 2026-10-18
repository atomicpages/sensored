//! Built-in `healthcare` detectors. Mirrors `packages/sensored/src/detectors/healthcare/`.

use std::sync::Arc;

use super::Registry;

mod health_insurance_id;

/// JS `\s` as a regex class body: Unicode `White_Space` without U+0085, plus
/// U+FEFF. The `regex` crate's `\s` differs in both.
const JS_SPACE: &str = r"\t\n\x0B\x0C\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}";

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(health_insurance_id::detector()));
}
