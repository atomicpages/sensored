//! Usernames, handles, Discord and Steam IDs. Mirrors `identity/digital-identity.ts`.

use std::sync::LazyLock;

use regex::Regex;

use crate::detector::{
    ContextHint, ContextMatcher, ContextScan, Detector, HintPosition, HintWindow, StreamMeta,
    is_adjacent_forbidden, push_aligned,
};
use crate::text::window_after;
use crate::types::Detection;

const ID: &str = "digital_identity";

const LEFT_CONTEXT: usize = 30;
const RIGHT_CONTEXT: usize = 20;

const LABELS: &str =
    "(?:Username|User ID|Handle|Screen Name|Gamertag|Discord ID|Steam ID|PSN ID|Xbox Gamertag)";

const LABEL_STRINGS: &[&str] = &[
    "Username",
    "User ID",
    "Handle",
    "Screen Name",
    "Gamertag",
    "Discord ID",
    "Steam ID",
    "PSN ID",
    "Xbox Gamertag",
];

const INSTRUCTIONS: &str = "Generic usernames require preceding context or parenthesized following context (e.g. \"john_doe (Username)\"). @-handles, Discord IDs, and Steam IDs accept any context position.";

const REASONS: [&str; 2] = ["digital_identity.format", "digital_identity.context"];

/// Matched case-insensitively against the whole candidate. Every entry is
/// ASCII without `k`, so an ASCII comparison equals TS's `toLowerCase()`
/// lookup (the only non-ASCII `\w` chars are `ſ`, which stays `ſ`, and the
/// Kelvin sign, which lowers to `k`).
const BLOCKLIST: &[&str] = &[
    "the", "and", "for", "admin", "but", "not", "are", "was", "has", "had", "this", "that", "with",
    "from", "your", "have", "more", "will", "can", "all", "any", "get", "set", "new", "old", "one",
    "two", "out", "how", "who", "why", "yes", "you", "its", "our", "now",
];

/// The TS pattern has the `iu` flags, under which JS `\w` also matches `ſ`
/// (U+017F) and the Kelvin sign (U+212A). `(?i)[A-Za-z0-9_]` folds the same
/// way; `\d` stays ASCII.
static PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)STEAM_[0-9]:[0-9]:[0-9]{1,20}|@[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,29}[A-Za-z0-9_])?|[0-9]{17,19}|[A-Za-z0-9_][A-Za-z0-9_.]{1,30}[A-Za-z0-9_]",
    )
    .expect("valid pattern")
});

static CONTEXT: LazyLock<ContextMatcher> =
    LazyLock::new(|| ContextMatcher::new(LABELS, LEFT_CONTEXT, RIGHT_CONTEXT));

/// Generic usernames only accept parenthesized following context
/// (`john_doe (Username)`), so ordinary words before a label do not match.
static FOLLOWING_PAREN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(r"(?i)^[ \t]{{1,8}}\({LABELS}\)")).expect("valid pattern")
});

fn is_ascii_digits(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit())
}

/// `/^\d{17,19}$/`
fn is_numeric_id(value: &str) -> bool {
    (17..=19).contains(&value.len()) && is_ascii_digits(value)
}

/// `/^STEAM_\d:\d:\d+$/i`.
fn is_steam_id(value: &str) -> bool {
    let Some((prefix, rest)) = value.split_at_checked(6) else {
        return false;
    };

    if !prefix.eq_ignore_ascii_case("STEAM_") {
        return false;
    }

    let bytes = rest.as_bytes();

    bytes.len() >= 5
        && bytes[0].is_ascii_digit()
        && bytes[1] == b':'
        && bytes[2].is_ascii_digit()
        && bytes[3] == b':'
        && bytes[4..].iter().all(u8::is_ascii_digit)
}

fn is_distinctive(value: &str) -> bool {
    value.starts_with('@') || is_numeric_id(value) || is_steam_id(value)
}

fn is_blocklisted(value: &str) -> bool {
    BLOCKLIST
        .iter()
        .any(|word| word.eq_ignore_ascii_case(value))
}

fn has_context(
    context: &ContextScan<'_, '_>,
    text: &str,
    value: &str,
    start: usize,
    end: usize,
) -> bool {
    if is_distinctive(value) {
        return context.has_context(start, end);
    }

    // The parenthesized form also needs a label, so the scan's pre-check holds.
    context.has_preceding(start)
        || (context.label_after(end)
            && FOLLOWING_PAREN.is_match(window_after(text, end, RIGHT_CONTEXT)))
}

pub struct DigitalIdentity;

impl Detector for DigitalIdentity {
    fn id(&self) -> &str {
        ID
    }

    fn entity_type(&self) -> &str {
        ID
    }

    fn replacement(&self) -> &str {
        "[DIGITAL_IDENTITY]"
    }

    fn stream(&self) -> Option<StreamMeta> {
        Some(StreamMeta::new(32, LEFT_CONTEXT, RIGHT_CONTEXT))
    }

    fn context_hint(&self) -> Option<ContextHint> {
        Some(ContextHint {
            required: true,
            labels: LABEL_STRINGS
                .iter()
                .map(|label| (*label).to_owned())
                .collect(),
            position: HintPosition::Both,
            window: HintWindow {
                before: LEFT_CONTEXT,
                after: RIGHT_CONTEXT,
            },
            instructions: Some(INSTRUCTIONS.to_owned()),
        })
    }

    fn detect(&self, text: &str, out: &mut Vec<Detection>) {
        let context = CONTEXT.scan(text);

        // Every branch needs a label nearby.
        if !context.any_label() {
            return;
        }

        let mut candidates = Vec::new();

        for found in PATTERN.find_iter(text) {
            let (start, end, value) = (found.start(), found.end(), found.as_str());

            if is_adjacent_forbidden(text, start, end) {
                continue;
            }

            // TS checks context first; the cheap rejections are side-effect
            // free, so running them before the context regexes is equivalent.
            if is_blocklisted(value) {
                continue;
            }

            // Pure numbers that are not Discord IDs are rejected.
            if is_ascii_digits(value) && !is_numeric_id(value) {
                continue;
            }

            if !has_context(&context, text, value, start, end) {
                continue;
            }

            candidates.push(Detection {
                start,
                end,
                rule_id: ID.to_owned(),
                entity_type: ID.to_owned(),
                reasons: REASONS.iter().map(|reason| (*reason).to_owned()).collect(),
            });
        }

        push_aligned(text, candidates, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detectors::identity::test_support::{spans, values};

    #[test]
    fn matches_labelled_identities() {
        let cases = [
            ("Username: john_doe", "john_doe"),
            ("User ID: player_one", "player_one"),
            ("Handle: @john.doe", "@john.doe"),
            ("Gamertag: xX_Slayer_Xx", "xX_Slayer_Xx"),
            ("Discord ID: 123456789012345678", "123456789012345678"),
            ("Steam ID: STEAM_0:1:123456789", "STEAM_0:1:123456789"),
            ("USERNAME: john_doe", "john_doe"),
            ("Username#john_doe", "john_doe"),
            ("Username: \t john_doe", "john_doe"),
            ("john_doe (Username)", "john_doe"),
            ("123456789012345678 (Discord ID)", "123456789012345678"),
            ("Discord ID: x123456789012345678", "x123456789012345678"),
        ];

        for (text, value) in cases {
            assert_eq!(values(&DigitalIdentity, text), [value], "{text}");
        }
    }

    #[test]
    fn rejects_unlabelled_or_filtered_candidates() {
        let cases = [
            "john_doe",
            "@alice",
            "123456789012345678",
            "STEAM_0:1:123456789",
            "Username: the",
            "Username: ADMIN",
            "Username: 12345",
            "myUsername: john_doe",
            "Username:\njohn_doe",
            "Username:         john_doe",
            "john_doe(Username)",
            "john_doe Username",
            "_Username: john_doe",
            "Username: john_doe\u{301}",
            "\u{1D7D9}Username: john_doe",
            "Username: caf\u{e9}",
            "Discord ID: 11111111111111111111",
            "Discord ID: 123456789012345678x",
        ];

        for text in cases {
            assert!(spans(&DigitalIdentity, text).is_empty(), "{text}");
        }
    }

    #[test]
    fn distinctive_ids_accept_unparenthesized_following_context() {
        assert_eq!(values(&DigitalIdentity, "@alice Handle"), ["@alice"]);
        assert!(spans(&DigitalIdentity, "alice Handle").is_empty());
    }

    #[test]
    fn length_bounds() {
        let generic = |n: usize| format!("Username: {}", "a".repeat(n));
        let handle = |n: usize| format!("Handle: @{}", "a".repeat(n));

        assert!(spans(&DigitalIdentity, "Username: ab").is_empty());
        assert_eq!(spans(&DigitalIdentity, &generic(32)), [(10, 42)]);
        assert!(spans(&DigitalIdentity, &generic(33)).is_empty());
        assert_eq!(values(&DigitalIdentity, "Handle: @a"), ["@a"]);
        assert_eq!(spans(&DigitalIdentity, &handle(31)), [(8, 40)]);
        assert!(spans(&DigitalIdentity, &handle(32)).is_empty());
    }

    #[test]
    fn steam_id_is_case_insensitive() {
        assert_eq!(
            values(&DigitalIdentity, "Steam ID: steam_0:1:5"),
            ["steam_0:1:5"]
        );
        assert_eq!(
            values(&DigitalIdentity, "steam_0:1:5 Steam ID"),
            ["steam_0:1:5"]
        );
        assert_eq!(
            values(&DigitalIdentity, "STEAM_0:1:5 Steam ID"),
            ["STEAM_0:1:5"]
        );
    }

    #[test]
    fn word_chars_fold_like_js_iu() {
        // JS `\w` with `iu` matches the long s and the Kelvin sign.
        assert_eq!(
            values(&DigitalIdentity, "Username: \u{17F}am"),
            ["\u{17F}am"]
        );
        assert_eq!(
            values(&DigitalIdentity, "Username: \u{212A}en"),
            ["\u{212A}en"]
        );
    }

    #[test]
    fn offsets_are_bytes_after_wide_chars() {
        assert_eq!(
            spans(&DigitalIdentity, "\u{1F600} Username: john_doe"),
            [(15, 23)]
        );
    }
}
