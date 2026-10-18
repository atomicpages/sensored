//! Mirrors `detectors/person/person-name-lite.ts`.
//!
//! The TS name pattern needs a `(?!Jr\b|Sr\b)` lookahead, which the `regex`
//! crate lacks, so the pattern is matched by hand here with the same
//! leftmost-first result:
//!
//! ```text
//! (?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+W(?:\s+W){0,3}(?:\s+S)?
//! | W(?:\s+W){1,3}(?:\s+S)?
//! W = (?!Jr\b|Sr\b)[A-Z][a-z]+
//! S = Jr\.|Sr\.|II|III|IV
//! ```

use super::bloom::{has_name, is_stopword};
use crate::detector::{Detector, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::types::Detection;

const ID: &str = "person_name_lite";

/// In alternation order.
const HONORIFICS: [&str; 5] = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];

/// In alternation order: `II` is tried before `III`, so a trailing `III`
/// matches as `II` (and the leftover `I` then fails the adjacency check).
const SUFFIXES: [&str; 5] = ["Jr.", "Sr.", "II", "III", "IV"];

/// Words a name may hold after the first, with and without an honorific.
const MAX_MORE_WORDS: usize = 3;

pub struct PersonNameLite;

impl Detector for PersonNameLite {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[PERSON_NAME]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(40, 0, 0))
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let mut candidates = Vec::new();
        let mut from = 0;

        while let Some((start, end)) = find_name(text, from) {
            from = end;

            let end = trim_end(text, start, end);

            if start >= end || !is_name(&text[start..end]) {
                continue;
            }

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            candidates.push(Detection {
                start,
                end,
                rule_id: ID.to_owned(),
                entity_type: ID.to_owned(),
                reasons: vec![format!("{ID}.bloom")],
            });
        }

        push_aligned(text, candidates, out);
    }
}

// ---------------------------------------------------------------------------
// Name pattern
// ---------------------------------------------------------------------------

/// The leftmost name match starting at or after `from`. Every match starts
/// with an ASCII capital, so only those bytes are tried.
fn find_name(text: &str, from: usize) -> Option<(usize, usize)> {
    let bytes = text.as_bytes();

    (from..bytes.len())
        .filter(|&start| bytes[start].is_ascii_uppercase())
        .find_map(|start| match_at(text, start).map(|end| (start, end)))
}

fn match_at(text: &str, start: usize) -> Option<usize> {
    with_honorific(text, start).or_else(|| without_honorific(text, start))
}

/// `Honorific \s+ W (\s+ W){0,3} (\s+ S)?`
fn with_honorific(text: &str, start: usize) -> Option<usize> {
    let honorific = HONORIFICS
        .iter()
        .find(|honorific| text[start..].starts_with(*honorific))?;

    let first = skip_space(text, start + honorific.len())?;
    let end = word(text, first)?;

    Some(more_words(text, end, MAX_MORE_WORDS))
}

/// `W (\s+ W){1,3} (\s+ S)?`
fn without_honorific(text: &str, start: usize) -> Option<usize> {
    let end = word(text, start)?;
    let second = skip_space(text, end)?;
    let end = word(text, second)?;

    Some(more_words(text, end, MAX_MORE_WORDS - 1))
}

/// Up to `limit` more `\s+ W`, then an optional `\s+ S`; all greedy.
fn more_words(text: &str, mut end: usize, limit: usize) -> usize {
    for _ in 0..limit {
        match skip_space(text, end).and_then(|next| word(text, next)) {
            Some(next) => end = next,
            None => break,
        }
    }

    skip_space(text, end)
        .and_then(|next| suffix(text, next))
        .unwrap_or(end)
}

/// `(?!Jr\b|Sr\b)[A-Z][a-z]+`; returns the end of the word.
fn word(text: &str, start: usize) -> Option<usize> {
    let bytes = text.as_bytes();

    if !bytes.get(start)?.is_ascii_uppercase() {
        return None;
    }

    let lower = bytes[start + 1..]
        .iter()
        .take_while(|byte| byte.is_ascii_lowercase())
        .count();

    if lower == 0 {
        return None;
    }

    let end = start + 1 + lower;
    let is_suffix_word = matches!(&text[start..end], "Jr" | "Sr");

    // `\b` after `Jr` is ASCII: the next byte is not `[A-Za-z0-9_]`.
    let at_boundary = bytes
        .get(end)
        .is_none_or(|&byte| !(byte.is_ascii_alphanumeric() || byte == b'_'));

    if is_suffix_word && at_boundary {
        return None;
    }

    Some(end)
}

fn suffix(text: &str, start: usize) -> Option<usize> {
    SUFFIXES
        .iter()
        .find(|suffix| text[start..].starts_with(*suffix))
        .map(|suffix| start + suffix.len())
}

/// `\s+`: one or more JS whitespace characters; returns the end of the run.
fn skip_space(text: &str, start: usize) -> Option<usize> {
    let run: usize = text[start..]
        .chars()
        .take_while(|&ch| is_js_space(ch))
        .map(char::len_utf8)
        .sum();

    (run > 0).then_some(start + run)
}

/// JS `\s`: Unicode `White_Space` without U+0085, plus U+FEFF.
fn is_js_space(ch: char) -> bool {
    match ch {
        '\u{85}' => false,
        '\u{FEFF}' => true,
        _ => ch.is_whitespace(),
    }
}

// ---------------------------------------------------------------------------
// Post-match checks
// ---------------------------------------------------------------------------

/// Trims trailing punctuation (unless the match ends with a suffix) and a
/// possessive `'s`. Kept for parity, though a match always ends with a
/// letter or a suffix, so neither trim ever fires.
fn trim_end(text: &str, start: usize, end: usize) -> usize {
    let matched = &text[start..end];

    let ends_with_suffix = SUFFIXES.iter().any(|suffix| {
        matched.ends_with(suffix)
            || matched
                .strip_suffix('.')
                .is_some_and(|rest| rest.ends_with(suffix))
    });

    let mut end = end;

    if !ends_with_suffix {
        let bytes = text.as_bytes();

        while end > start && b".,;:)]}>?!".contains(&bytes[end - 1]) {
            end -= 1;
        }
    }

    if text[start..end].ends_with("'s") {
        end -= 2;
    }

    end
}

/// A single word needs an honorific and a bloom hit; several words need one
/// that is in the bloom filter and not a stopword.
fn is_name(clean: &str) -> bool {
    let has_honorific = HONORIFICS
        .iter()
        .any(|honorific| clean.starts_with(honorific));

    let mut words = name_words(clean);
    let is_single = words.clone().nth(1).is_none();

    if !is_single {
        return words.any(|word| has_name(word) && !is_stopword(word));
    }

    match words.next() {
        Some(word) => has_honorific && has_name(word),
        None => false,
    }
}

/// The words without honorific and suffix. Mirrors
/// `.replace(/^(?:Mr\.|...)\s+/, "").replace(/(?:Jr\.|...)$/, "").trim().split(/\s+/)`.
fn name_words(clean: &str) -> impl Iterator<Item = &str> + Clone {
    let rest = HONORIFICS
        .iter()
        .find_map(|honorific| clean.strip_prefix(honorific))
        .and_then(|rest| {
            let trimmed = rest.trim_start_matches(is_js_space);

            (trimmed.len() < rest.len()).then_some(trimmed)
        })
        .unwrap_or(clean);

    // The leftmost suffix that ends the string is the longest one.
    let suffix_len = SUFFIXES
        .iter()
        .filter(|suffix| rest.ends_with(*suffix))
        .map(|suffix| suffix.len())
        .max()
        .unwrap_or(0);

    rest[..rest.len() - suffix_len]
        .split(is_js_space)
        .filter(|word| !word.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spans(text: &str) -> Vec<&str> {
        let mut out = Vec::new();
        PersonNameLite.detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }

    /// From `test/person-name-lite.test.ts`.
    #[test]
    fn detects_names() {
        let cases: &[(&str, &[&str])] = &[
            ("Name: John Smith", &["John Smith"]),
            ("Dr. Jane Doe is here", &["Dr. Jane Doe"]),
            ("John Smith and Jane Doe", &["John Smith", "Jane Doe"]),
            ("Patient: Mary Johnson visited", &["Mary Johnson"]),
            ("Robert Downey Jr. is an actor", &["Robert Downey Jr."]),
            (
                "Martin Luther King Jr. gave a speech",
                &["Martin Luther King Jr."],
            ),
            ("Mr. James Jones is here", &["Mr. James Jones"]),
            ("Ms. Jones is here", &["Ms. Jones"]),
            ("before John Smith after", &["John Smith"]),
            ("John Smith.", &["John Smith"]),
            ("(John Smith)", &["John Smith"]),
        ];

        for (input, expected) in cases {
            assert_eq!(spans(input), *expected, "{input}");
        }
    }

    /// From `test/person-name-lite.test.ts`.
    #[test]
    fn rejects_non_names() {
        let cases = [
            "The weather is nice",
            "Hope is important",
            "Mark the checkbox",
            "Pat the dog",
            "Joy is an emotion",
            "The patient visited yesterday",
            "Please check the box",
            "The Quick Brown Fox",
            "How are you",
        ];

        for input in cases {
            assert!(spans(input).is_empty(), "{input}");
        }
    }

    #[test]
    fn offsets_and_reasons() {
        let mut out = Vec::new();
        PersonNameLite.detect("Name: John Smith", &mut out);

        assert_eq!((out[0].start, out[0].end), (6, 16));
        assert_eq!(out[0].reasons, ["person_name_lite.bloom"]);
    }

    #[test]
    fn suffix_words_are_not_name_words() {
        assert!(spans("John Jr. Smith").is_empty());
        assert_eq!(spans("Dr. John Jr. Smith"), ["Dr. John Jr."]);
        assert!(spans("John Sr").is_empty());
        assert_eq!(spans("John Jrx"), ["John Jrx"]);
    }

    #[test]
    fn roman_numeral_three_matches_as_two_then_fails_adjacency() {
        assert_eq!(spans("John Smith II"), ["John Smith II"]);
        assert!(spans("John Smith III").is_empty());
    }

    #[test]
    fn caps_at_four_words() {
        assert_eq!(
            spans("John Paul George Ringo Smith"),
            ["John Paul George Ringo"]
        );
    }

    #[test]
    fn js_whitespace_separates_words() {
        assert_eq!(spans("John\u{FEFF}Smith"), ["John\u{FEFF}Smith"]);
        assert_eq!(spans("John\u{A0}Smith"), ["John\u{A0}Smith"]);
        assert!(spans("John\u{85}Smith").is_empty());
    }

    #[test]
    fn match_inside_a_word_is_rejected() {
        assert!(spans("xJohn Smith").is_empty());
        assert!(spans("John Smithé").is_empty());
    }
}
