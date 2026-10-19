//! Mirrors `hash.ts`.

const OFFSET_BASIS: u32 = 0x811c_9dc5;
const PRIME: u32 = 0x0100_0193;

/// FNV-1a 32-bit over the UTF-16 code units of `text`, as TS hashes `charCodeAt`.
pub fn fnv1a32(text: &str) -> u32 {
    text.encode_utf16().fold(OFFSET_BASIS, |hash, unit| {
        (hash ^ u32::from(unit)).wrapping_mul(PRIME)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Expected values come from the TS `fnv1a32`.
    #[test]
    fn matches_ts_reference() {
        let cases = [
            ("", 2_166_136_261),
            ("a", 3_826_002_220),
            ("hello@example.com", 3_956_390_658),
            ("José Müller", 418_537_068),
            ("日本語", 1_409_693_518),
            ("😀", 3_409_036_472),
            ("a👨‍👩‍👧b", 2_675_157_569),
        ];

        for (text, expected) in cases {
            assert_eq!(fnv1a32(text), expected, "{text:?}");
        }
    }
}
