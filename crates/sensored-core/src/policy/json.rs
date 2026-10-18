//! JSON helpers with JS semantics. Mirrors `utils.ts`.
//!
//! A key that is present counts as defined, even with a `null` value: JSON has
//! no `undefined`, and TS treats `null` as a defined, invalid value.

use serde_json::{Map, Value};

use crate::errors::{ErrorCode, SensoredError};

/// `Number.MAX_SAFE_INTEGER`.
const MAX_SAFE_INTEGER: i64 = (1 << 53) - 1;

pub(super) fn invalid(path: &str) -> SensoredError {
    SensoredError::at(ErrorCode::InvalidConfig, path)
}

/// Mirrors `hasOnlyKeys`.
pub(super) fn has_only_keys(map: &Map<String, Value>, allowed: &[&str]) -> bool {
    map.keys().all(|key| allowed.contains(&key.as_str()))
}

/// `Number.isSafeInteger`: integral, within ±(2^53 - 1). `1.0` counts.
pub(super) fn safe_integer(value: &Value) -> Option<i64> {
    let number = value.as_number()?;

    let integer = match number.as_i64() {
        Some(integer) => integer,
        None => {
            let float = number.as_f64()?;

            if float.fract() != 0.0 || float.abs() > MAX_SAFE_INTEGER as f64 {
                return None;
            }

            // Lossless: `float` is integral and within the safe range.
            float as i64
        }
    };

    (integer.abs() <= MAX_SAFE_INTEGER).then_some(integer)
}

/// Mirrors `isNonNegativeInteger`.
pub(super) fn non_negative_integer(value: &Value) -> Option<u64> {
    safe_integer(value).and_then(|integer| u64::try_from(integer).ok())
}

/// A non-empty string, the shape TS checks for names and list entries.
pub(super) fn non_empty_str(value: &Value) -> Option<&str> {
    value.as_str().filter(|s| !s.is_empty())
}

/// `^[a-z][a-z0-9_]*$` (detector ids), or with `-` too (preset names).
pub(super) fn is_identifier(value: &str, allow_dash: bool) -> bool {
    let mut chars = value.chars();

    let Some(first) = chars.next() else {
        return false;
    };

    first.is_ascii_lowercase()
        && chars.all(|ch| {
            ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || (allow_dash && ch == '-')
        })
}

/// Entries in `Object.entries` order: array-index keys ascending, then the
/// rest in insertion order. Insertion order needs serde_json's
/// `preserve_order` feature; without it, the map is already sorted.
pub(super) fn js_entries(map: &Map<String, Value>) -> Vec<(&str, &Value)> {
    let mut entries: Vec<(&str, &Value)> = map.iter().map(|(k, v)| (k.as_str(), v)).collect();

    // Stable, so non-index keys keep their order.
    entries.sort_by_key(|(key, _)| match array_index(key) {
        Some(index) => (false, index),
        None => (true, 0),
    });

    entries
}

/// A canonical array index: `0` or a decimal without a leading zero, below
/// 2^32 - 1.
fn array_index(key: &str) -> Option<u32> {
    if key.is_empty() || (key.len() > 1 && key.starts_with('0')) {
        return None;
    }

    if !key.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }

    key.parse::<u32>().ok().filter(|&index| index != u32::MAX)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn safe_integers_follow_js() {
        assert_eq!(safe_integer(&json!(2)), Some(2));
        assert_eq!(safe_integer(&json!(-2)), Some(-2));
        assert_eq!(safe_integer(&json!(2.0)), Some(2));
        assert_eq!(safe_integer(&json!(1.5)), None);
        assert_eq!(safe_integer(&json!(9_007_199_254_740_992_u64)), None);
        assert_eq!(safe_integer(&json!("1")), None);
        assert_eq!(non_negative_integer(&json!(-1)), None);
    }

    #[test]
    fn identifiers() {
        assert!(is_identifier("pci-dss", true));
        assert!(!is_identifier("pci-dss", false));
        assert!(!is_identifier("Team", true));
        assert!(!is_identifier("1team", true));
        assert!(!is_identifier("", true));
    }

    #[test]
    fn entries_put_array_indexes_first() {
        let map = json!({ "b": 1, "10": 2, "a": 3, "2": 4, "01": 5 });
        let keys: Vec<&str> = js_entries(map.as_object().unwrap())
            .into_iter()
            .map(|(key, _)| key)
            .collect();

        assert_eq!(&keys[..2], ["2", "10"]);
        assert_eq!(keys.len(), 5);
    }
}
