mod support;

use indexmap::IndexMap;
use sensored_core::restore::restore;
use sensored_core::stream_restore::StreamRestorer;
use sensored_core::types::RestorationMap;
use support::RestoreCase;

fn cases() -> Vec<RestoreCase> {
    support::golden("restore.json")
}

fn map_of(entries: &[(&str, &str)]) -> RestorationMap {
    entries
        .iter()
        .map(|&(k, v)| (k.to_owned(), v.to_owned()))
        .collect::<IndexMap<_, _>>()
}

fn stream(chunks: &[&str], map: &RestorationMap) -> String {
    let mut restorer = StreamRestorer::new(map.clone());
    let mut out: String = chunks.iter().map(|chunk| restorer.push(chunk)).collect();
    out.push_str(&restorer.flush());

    out
}

#[test]
fn golden_restore() {
    for case in cases() {
        assert_eq!(
            restore(&case.input, &case.map),
            case.expected,
            "{}",
            case.id
        );
    }
}

#[test]
fn golden_stream_restore_every_split() {
    for case in cases().into_iter().filter(|case| case.streamed) {
        let input = case.input.as_str();
        let boundaries = input.char_indices().map(|(i, _)| i).chain([input.len()]);

        for split in boundaries {
            let (head, tail) = input.split_at(split);

            assert_eq!(
                stream(&[head, tail], &case.map),
                case.expected,
                "{} split at byte {split}",
                case.id
            );
        }
    }
}

#[test]
fn golden_stream_restore_char_by_char() {
    for case in cases().into_iter().filter(|case| case.streamed) {
        let mut buf = [0; 4];
        let chars: Vec<String> = case
            .input
            .chars()
            .map(|c| c.encode_utf8(&mut buf).to_owned())
            .collect();
        let chunks: Vec<&str> = chars.iter().map(String::as_str).collect();

        assert_eq!(stream(&chunks, &case.map), case.expected, "{}", case.id);
    }
}

#[test]
fn values_are_inserted_literally() {
    let map = map_of(&[("[A_1]", "$& $1 $$ $<x> $`")]);

    assert_eq!(restore("<[A_1]>", &map), "<$& $1 $$ $<x> $`>");
}

#[test]
fn unicode_digits_are_not_placeholder_digits() {
    let map = map_of(&[("[A_\u{0661}]", "x")]);

    assert_eq!(restore("[A_\u{0661}]", &map), "[A_\u{0661}]");
}

#[test]
fn push_holds_only_prefixes_of_map_keys() {
    let mut restorer =
        StreamRestorer::new(map_of(&[("[EMAIL_1]", "a@b.c"), ("[EMAIL_12]", "x@y.z")]));

    assert_eq!(restorer.push("hi [EMA"), "hi ");
    assert_eq!(restorer.push("IL_1"), "");
    assert_eq!(restorer.push("] and [PHONE"), "a@b.c and [PHONE");
    assert_eq!(restorer.push(" [EMAIL_1"), " ");
    assert_eq!(restorer.push("2]"), "x@y.z");
    assert_eq!(restorer.flush(), "");
}

#[test]
fn exact_key_without_closing_bracket_is_released() {
    // A non-placeholder key equal to the tail is not a proper prefix.
    let mut restorer = StreamRestorer::new(map_of(&[("[A", "x"), ("[AB_1]", "y")]));

    assert_eq!(restorer.push("1 [A"), "1 ");
    assert_eq!(restorer.push("B"), "");
    assert_eq!(restorer.push("C"), "[ABC");
}

#[test]
fn flush_restores_held_tail_and_resets() {
    let mut restorer = StreamRestorer::new(map_of(&[("[A_1]", "x")]));

    assert_eq!(restorer.push("[A_"), "");
    assert_eq!(restorer.flush(), "[A_");
    assert_eq!(restorer.flush(), "");
    assert_eq!(restorer.push("[A_1]"), "x");
}
