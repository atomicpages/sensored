//! Rule-based person-name NER. Replaces the TS `person-name.ts`, which wraps
//! `compromise`; the metadata matches, the matches do not.
//!
//! One pass over the words of the text finds capitalized runs: up to four
//! capitalized words joined by horizontal spaces, with lowercase particles
//! (`van`, `de`) and initials (`F.`) between them. A run is a name when:
//!
//! - an honorific (`Dr.`, `Mrs`) precedes it; the honorific is not part of
//!   the span; or
//! - it holds at least two name words, its first word is in the bloom filter,
//!   at most one other word is not, and at least one is not a stopword.
//!
//! At a sentence start a capital is no evidence, so a first word that is not
//! a confident name (in the bloom filter, not a stopword) is dropped before
//! that check (`Will Smith` opens no name there, `met Will Smith` does), and
//! every name word must be in the bloom filter (`Abu Dhabi: 123` is no name)
//! unless the run holds a particle or an initial (`Vincent van Gogh`).
//!
//! A run is rejected whole when it holds a word that marks a place, street,
//! organization or label (`Lincoln Avenue`, `Ghana Card`) or more than four
//! name words (title case). A generational suffix (`Jr.`, `III`) extends the
//! span, also after a comma.
//!
//! Spans end at a word or a suffix by construction, so the TS trims (trailing
//! punctuation unless an abbreviation suffix, possessive `'s`) hold without a
//! separate pass.

use std::iter::Peekable;

use super::bloom::{contains_folded, has_name, is_stopword};
use super::lexicon::{
    ABBREVIATED_SUFFIXES, FUNCTION_WORDS, HONORIFICS, NON_NAME_WORDS, PARTICLES, SUFFIXES,
};
use crate::detector::{Detector, StreamMeta, is_adjacent_forbidden, push_aligned};
use crate::text::is_js_space;
use crate::types::Detection;

const ID: &str = "person_name";

/// Name words in a run; longer capitalized runs are title case.
const MAX_NAME_WORDS: usize = 4;

/// Words in a run, counting particles and initials.
const MAX_RUN_WORDS: usize = 8;

pub struct PersonName;

impl Detector for PersonName {
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
        let mut words = Words::new(text).peekable();

        while let Some(word) = words.next() {
            // Every name and title starts with a capital.
            if !starts_upper(&text[word.start..word.end]) {
                continue;
            }

            let titled = is_honorific(text, word);

            let first = if titled {
                words.next_if(|next| follows_title(text, word, *next))
            } else {
                Some(word)
            };

            let Some(first) = first.filter(|first| kind(text, *first) == Kind::Name) else {
                continue;
            };

            let run = Run::collect(text, first, &mut words);
            let sentence_start = !titled && is_sentence_start(text, first.start);

            let Some((start, end)) = run.name_span(text, titled, sentence_start) else {
                continue;
            };

            let end = match words.peek().and_then(|next| suffix_end(text, end, *next)) {
                Some(suffix_end) => {
                    words.next();
                    suffix_end
                }
                None => end,
            };

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            candidates.push(Detection {
                start,
                end,
                rule_id: ID.to_owned(),
                entity_type: ID.to_owned(),
                reasons: vec![format!("{ID}.ner")],
            });
        }

        push_aligned(text, candidates, out);
    }
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/// A word's byte range.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Word {
    start: usize,
    end: usize,
}

/// The words of a text in order: alphanumeric runs, joined across a hyphen
/// (`Jean-Luc`) and across an apostrophe after one letter (`O'Brien`). A
/// possessive `'s` is not part of the word.
struct Words<'t> {
    text: &'t str,
    pos: usize,
}

impl<'t> Words<'t> {
    fn new(text: &'t str) -> Self {
        Self { text, pos: 0 }
    }
}

impl Iterator for Words<'_> {
    type Item = Word;

    fn next(&mut self) -> Option<Word> {
        let Some(start) = word_start(self.text, self.pos) else {
            self.pos = self.text.len();

            return None;
        };

        let end = word_end(self.text, start);
        self.pos = end;

        Some(Word { start, end })
    }
}

/// The first alphanumeric character at or after `from`. ASCII bytes are
/// checked without decoding.
fn word_start(text: &str, from: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    let mut pos = from;

    while let Some(&byte) = bytes.get(pos) {
        if byte.is_ascii() {
            if byte.is_ascii_alphanumeric() {
                return Some(pos);
            }

            pos += 1;
            continue;
        }

        let ch = char_at(text, pos)?;

        if ch.is_alphanumeric() {
            return Some(pos);
        }

        pos += ch.len_utf8();
    }

    None
}

fn word_end(text: &str, start: usize) -> usize {
    let first_len = char_at(text, start).map_or(0, char::len_utf8);
    let mut end = start;

    while let Some(ch) = char_at(text, end) {
        let letter_follows = || char_at(text, end + ch.len_utf8()).is_some_and(char::is_alphabetic);

        let joins = match ch {
            '-' => letter_follows(),
            '\'' | '\u{2019}' => end - start == first_len && letter_follows(),
            _ => ch.is_alphanumeric(),
        };

        if !joins {
            break;
        }

        end += ch.len_utf8();
    }

    end
}

/// The character at byte `pos`, which must be a char boundary.
fn char_at(text: &str, pos: usize) -> Option<char> {
    match text.as_bytes().get(pos) {
        Some(&byte) if byte.is_ascii() => Some(char::from(byte)),
        _ => text.get(pos..)?.chars().next(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    /// A capitalized word that may be part of a name.
    Name,
    /// One capital letter followed by a period.
    Initial,
    /// A lowercase particle such as `van`.
    Particle,
    /// Anything else; it ends a run.
    Other,
}

fn kind(text: &str, word: Word) -> Kind {
    let value = &text[word.start..word.end];

    if !starts_upper(value) {
        let is_particle =
            value.starts_with(char::is_lowercase) && contains_folded(PARTICLES, value);

        return if is_particle {
            Kind::Particle
        } else {
            Kind::Other
        };
    }

    if is_initial(text, word) {
        return Kind::Initial;
    }

    let is_name = is_capitalized(value)
        && !SUFFIXES.contains(&value)
        && !contains_folded(FUNCTION_WORDS, value);

    if is_name { Kind::Name } else { Kind::Other }
}

fn starts_upper(value: &str) -> bool {
    value.starts_with(char::is_uppercase)
}

/// An uppercase letter, then letters (and joiners) with no two capitals in a
/// row: `John`, `McDonald`, `O'Brien`, but not `IBM` or `iPhone`.
fn is_capitalized(value: &str) -> bool {
    let mut chars = value.chars();

    if !chars.next().is_some_and(char::is_uppercase) {
        return false;
    }

    let mut previous_upper = true;
    let mut has_lower = false;

    for ch in chars {
        let upper = ch.is_uppercase();

        if (upper && previous_upper) || ch.is_numeric() {
            return false;
        }

        has_lower |= ch.is_lowercase();
        previous_upper = upper;
    }

    has_lower
}

fn is_initial(text: &str, word: Word) -> bool {
    let mut chars = text[word.start..word.end].chars();
    let single_capital = chars.next().is_some_and(char::is_uppercase) && chars.next().is_none();

    single_capital && text[word.end..].starts_with('.')
}

fn is_honorific(text: &str, word: Word) -> bool {
    let value = &text[word.start..word.end];

    is_capitalized(value) && contains_folded(HONORIFICS, value)
}

// ---------------------------------------------------------------------------
// Gaps between words
// ---------------------------------------------------------------------------

/// Whitespace within a line: JS `\s` without line terminators.
fn is_inline_space(ch: char) -> bool {
    is_js_space(ch) && !matches!(ch, '\n' | '\r' | '\x0B' | '\x0C' | '\u{2028}' | '\u{2029}')
}

/// One or more inline spaces.
fn is_spacing(gap: &str) -> bool {
    !gap.is_empty() && gap.chars().all(is_inline_space)
}

/// One or more inline spaces after an optional `lead` character.
fn is_spacing_after(gap: &str, lead: char) -> bool {
    is_spacing(gap.strip_prefix(lead).unwrap_or(gap))
}

/// Whether `next` continues the run after `previous`. An initial carries
/// its period into the gap.
fn joins(text: &str, previous: Word, next: Word) -> bool {
    let gap = &text[previous.end..next.start];

    if is_initial(text, previous) {
        return gap.starts_with('.') && is_spacing_after(gap, '.');
    }

    is_spacing(gap)
}

/// `Dr. Jane`, `Dr Jane`.
fn follows_title(text: &str, title: Word, next: Word) -> bool {
    is_spacing_after(&text[title.end..next.start], '.') && kind(text, next) == Kind::Name
}

/// The end of a generational suffix after a name ending at `end`: `Jr.`,
/// `III`, also after a comma (`Smith, Jr.`).
fn suffix_end(text: &str, end: usize, next: Word) -> Option<usize> {
    let value = &text[next.start..next.end];

    if !SUFFIXES.contains(&value) || !is_spacing_after(&text[end..next.start], ',') {
        return None;
    }

    let abbreviated = ABBREVIATED_SUFFIXES.contains(&value) && text[next.end..].starts_with('.');

    Some(next.end + usize::from(abbreviated))
}

/// Whether the word at `start` opens a sentence: it starts the text or a
/// line, or follows `.`, `!`, `?` or `…`, ignoring spaces and opening quotes.
fn is_sentence_start(text: &str, start: usize) -> bool {
    let previous = text[..start]
        .chars()
        .rev()
        .find(|&ch| !is_inline_space(ch) && !matches!(ch, '"' | '\'' | '“' | '‘' | '(' | '['));

    match previous {
        None => true,
        Some(ch) => {
            matches!(ch, '.' | '!' | '?' | '…') || (is_js_space(ch) && !is_inline_space(ch))
        }
    }
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/// A capitalized run: name words with particles and initials between them.
struct Run {
    words: [(Word, Kind); MAX_RUN_WORDS],
    len: usize,
    names: usize,
    overflow: bool,
}

impl Run {
    /// Takes `first` and every word that continues it from `words`. A run
    /// that grows past the limits is consumed whole and marked `overflow`.
    fn collect(text: &str, first: Word, words: &mut Peekable<Words<'_>>) -> Self {
        let mut run = Self {
            words: [(first, Kind::Name); MAX_RUN_WORDS],
            len: 1,
            names: 1,
            overflow: false,
        };

        let mut last = first;

        while let Some(next) =
            words.next_if(|next| joins(text, last, *next) && kind(text, *next) != Kind::Other)
        {
            run.push(next, kind(text, next));
            last = next;
        }

        run.trim_end();

        run
    }

    fn push(&mut self, word: Word, kind: Kind) {
        if kind == Kind::Name {
            self.names += 1;
        }

        if self.len == MAX_RUN_WORDS || self.names > MAX_NAME_WORDS {
            self.overflow = true;

            return;
        }

        self.words[self.len] = (word, kind);
        self.len += 1;
    }

    /// Drops trailing particles and initials: a name ends with a name word.
    fn trim_end(&mut self) {
        while self.words[self.len - 1].1 != Kind::Name {
            self.len -= 1;
        }
    }

    /// The name's byte range, if the run is one.
    fn name_span(&self, text: &str, titled: bool, sentence_start: bool) -> Option<(usize, usize)> {
        let words = &self.words[..self.len];
        let value = |word: Word| &text[word.start..word.end];

        if self.overflow || (!titled && self.names < 2) {
            return None;
        }

        let is_marked = words
            .iter()
            .any(|(word, kind)| *kind == Kind::Name && is_non_name(value(*word)));

        if is_marked {
            return None;
        }

        let span = |words: &[(Word, Kind)]| Some((words[0].0.start, words[words.len() - 1].0.end));

        if titled {
            return span(words);
        }

        // A capital at a sentence start is no evidence: drop an unsure first
        // word up to the next name word.
        let words = if sentence_start && !Evidence::of(value(words[0].0)).confident {
            let next = words[1..]
                .iter()
                .position(|(_, kind)| *kind == Kind::Name)?;

            &words[next + 1..]
        } else {
            words
        };

        // A particle or initial is structural evidence a capital is not.
        let is_structured = words.iter().any(|(_, kind)| *kind != Kind::Name);
        let max_unknown = usize::from(!sentence_start || is_structured);

        let names = words.iter().filter(|(_, kind)| *kind == Kind::Name);
        let mut count = 0;
        let mut unknown = 0;
        let mut confident = false;

        for (word, _) in names {
            let evidence = Evidence::of(value(*word));

            // The first name word must be known.
            if count == 0 && !evidence.known {
                return None;
            }

            count += 1;
            unknown += usize::from(!evidence.known);
            confident |= evidence.confident;
        }

        if count >= 2 && unknown <= max_unknown && confident {
            span(words)
        } else {
            None
        }
    }
}

/// What the bloom filter and stopwords say about one word.
struct Evidence {
    /// In the bloom filter (for a hyphenated word, any part).
    known: bool,
    /// Known and not also a common word.
    confident: bool,
}

impl Evidence {
    fn of(value: &str) -> Self {
        let known = has_name(value) || (value.contains('-') && value.split('-').any(has_name));

        Self {
            known,
            confident: known && !is_stopword(value),
        }
    }
}

/// A word that marks a place, street, organization or label.
fn is_non_name(value: &str) -> bool {
    contains_folded(NON_NAME_WORDS, value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spans(text: &str) -> Vec<&str> {
        let mut out = Vec::new();
        PersonName.detect(text, &mut out);

        out.iter().map(|d| &text[d.start..d.end]).collect()
    }

    fn assert_cases(cases: &[(&str, &[&str])]) {
        for (input, expected) in cases {
            assert_eq!(spans(input), *expected, "{input}");
        }
    }

    #[test]
    fn offsets_and_reasons() {
        let mut out = Vec::new();
        PersonName.detect("Name: John Smith", &mut out);

        assert_eq!((out[0].start, out[0].end), (6, 16));
        assert_eq!(out[0].rule_id, "person_name");
        assert_eq!(out[0].entity_type, "person_name");
        assert_eq!(out[0].reasons, ["person_name.ner"]);
    }

    #[test]
    fn capitalized_runs_of_known_names() {
        assert_cases(&[
            ("Name: John Smith", &["John Smith"]),
            ("Regards, Thomas Williams", &["Thomas Williams"]),
            ("John Smith and Jane Doe met", &["John Smith", "Jane Doe"]),
            ("before Mary Ann Johnson after", &["Mary Ann Johnson"]),
            ("(John Smith)", &["John Smith"]),
            ("\"John Smith\"", &["John Smith"]),
        ]);
    }

    #[test]
    fn single_capitalized_words_are_not_names() {
        assert_cases(&[
            ("Contact John today", &[]),
            ("Smith", &[]),
            ("Ask Mary.", &[]),
        ]);
    }

    #[test]
    fn one_unknown_word_after_a_known_first_word() {
        assert_cases(&[
            ("Contact: Jane Qwxzv", &["Jane Qwxzv"]),
            ("Contact: Jane Qwxzv Brrkt", &[]),
            ("Contact: Qwxzv Smith", &[]),
            ("Jane Qwxzv called", &[]),
            ("Abu Dhabi: 123", &[]),
            ("Vincent van Qwxzv painted", &["Vincent van Qwxzv"]),
        ]);
    }

    #[test]
    fn honorifics_are_evidence_and_not_part_of_the_span() {
        assert_cases(&[
            ("Dr. Jane Doe is here", &["Jane Doe"]),
            ("Ms. Jones is here", &["Jones"]),
            ("Mrs Qwxzv called", &["Qwxzv"]),
            ("Prof. Ada King Lovelace", &["Ada King Lovelace"]),
            ("ask Professor Plum", &["Plum"]),
            ("Dr. the patient", &[]),
            ("Mr.Smith", &[]),
        ]);
    }

    #[test]
    fn sentence_start_capital_is_not_evidence() {
        assert_cases(&[
            ("Will Smith arrived", &[]),
            ("We met Will Smith there", &["Will Smith"]),
            ("It rained. Will Smith left", &[]),
            ("Yesterday Jane Smith called", &["Jane Smith"]),
            ("Thomas Williams called", &["Thomas Williams"]),
            ("Monday Morning", &[]),
            ("Hope Springs", &[]),
        ]);
    }

    #[test]
    fn surname_suffixes_extend_the_name() {
        assert_cases(&[
            ("Robert Downey Jr. is an actor", &["Robert Downey Jr."]),
            ("Martin Luther King Jr. spoke", &["Martin Luther King Jr."]),
            (
                "John Smith III and Jane Doe II",
                &["John Smith III", "Jane Doe II"],
            ),
            ("Robert Downey, Jr. is here", &["Robert Downey, Jr."]),
            ("Robert Downey Sr was there", &["Robert Downey Sr"]),
            ("John Jr. Smith", &[]),
        ]);
    }

    #[test]
    fn trims_punctuation_and_possessives() {
        assert_cases(&[
            ("I saw John Smith.", &["John Smith"]),
            (
                "John Smith, Jane Doe; Mary Major!",
                &["John Smith", "Jane Doe", "Mary Major"],
            ),
            ("John Smith's car", &["John Smith"]),
            ("John Smith\u{2019}s car", &["John Smith"]),
        ]);
    }

    #[test]
    fn particles_initials_and_joined_words() {
        assert_cases(&[
            ("painted by Vincent van Gogh", &["Vincent van Gogh"]),
            ("by Ludwig van Beethoven.", &["Ludwig van Beethoven"]),
            ("President John F. Kennedy spoke", &["John F. Kennedy"]),
            ("met John F. Kennedy there", &["John F. Kennedy"]),
            ("met Jean-Luc Picard", &["Jean-Luc Picard"]),
            ("met Conan O'Brien", &["Conan O'Brien"]),
            ("met Ronald McDonald", &["Ronald McDonald"]),
            ("met Jürgen Müller", &["Jürgen Müller"]),
            ("met John van", &[]),
        ]);
    }

    #[test]
    fn places_streets_organizations_and_labels() {
        assert_cases(&[
            ("1234 Lincoln Avenue", &[]),
            ("Address 55 Maple Ave Address", &[]),
            ("Ghana Card: GHA-123", &[]),
            ("Medical Record Number: 123", &[]),
            ("Plate No: ABC123", &[]),
            ("born in South Africa", &[]),
            ("flew to New York", &[]),
            ("works at Morgan Partners", &[]),
            ("Customer Service team", &[]),
            ("Citizen Service Number: 1", &[]),
        ]);
    }

    #[test]
    fn title_case_and_all_caps() {
        assert_cases(&[
            ("The Quick Brown Fox", &[]),
            ("Annual Report For Fiscal Year", &[]),
            ("John Paul George Ringo Smith", &[]),
            ("JOHN SMITH signed", &[]),
            ("Meeting With John Smith", &["John Smith"]),
        ]);
    }

    #[test]
    fn names_do_not_span_lines() {
        assert_cases(&[
            ("William White\nEmail: a@b.c", &["William White"]),
            ("Name: William White\nEmail: a@b.c", &["William White"]),
            ("Name: Dorothy\nMiller", &[]),
        ]);
    }

    #[test]
    fn match_inside_a_word_is_rejected() {
        assert_cases(&[
            ("xJohn Smith", &[]),
            ("John Smith2", &[]),
            ("John Smith\u{301}", &[]),
        ]);
    }
}
