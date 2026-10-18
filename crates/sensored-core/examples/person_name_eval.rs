//! Scores the rule-based `person_name` detector on the eval corpus, as
//! `packages/sensored/eval/person-name-baseline.ts` scores the TS detectors:
//! matches are relabelled `person_name_lite` and compared as exact spans with
//! the corpus's `person_name_lite` labels, negatives included.
//!
//! `cargo run --release --example person_name_eval -- <corpus.json> [--verbose]`
//!
//! The corpus is gitignored; generate it with `bun run eval:generate` in
//! `packages/sensored`. Two scorings are printed:
//!
//! - `official`: every `person_name_lite` label. Most labels are
//!   `person_name_lite`'s own false positives adopted into the corpus
//!   (`Plate No`, `Ghana Card`, `Lincoln Avenue`), so this rewards copying them.
//! - `true_names`: only the generated names (`name-pos-*` and `mixed-*` cases),
//!   without labels that cross a line break.
//!
//! It also prints false positives on the negative documents, a hand-written
//! set of tricky cases, and throughput over the corpus text.

use std::collections::HashSet;
use std::time::Instant;

use sensored_core::Redactor;
use sensored_core::text::utf16_to_utf8;
use serde::Deserialize;
use serde_json::json;

const LABEL: &str = "person_name_lite";

#[derive(Deserialize)]
struct Corpus {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    id: String,
    text: String,
    kind: String,
    expected: Vec<Tuple>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Tuple {
    rule_id: String,
    start: usize,
    end: usize,
}

#[derive(Default)]
struct Score {
    tp: usize,
    fp: usize,
    fn_: usize,
}

impl Score {
    fn add(&mut self, expected: &HashSet<(usize, usize)>, actual: &HashSet<(usize, usize)>) {
        self.tp += actual.intersection(expected).count();
        self.fp += actual.difference(expected).count();
        self.fn_ += expected.difference(actual).count();
    }

    fn print(&self, name: &str) {
        let ratio = |num: usize, den: usize| (den > 0).then(|| num as f64 / den as f64);
        let precision = ratio(self.tp, self.tp + self.fp);
        let recall = ratio(self.tp, self.tp + self.fn_);

        let f1 = match (precision, recall) {
            (Some(p), Some(r)) if p + r > 0.0 => Some(2.0 * p * r / (p + r)),
            _ => None,
        };

        let report = json!({
            "tp": self.tp,
            "fp": self.fp,
            "fn": self.fn_,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        });

        println!("{name}: {report}");
    }
}

/// Tricky non-faker cases: input and the expected name spans.
const TRICKY: &[(&str, &[&str])] = &[
    ("Will Smith arrived late.", &["Will Smith"]),
    ("We will meet Will Smith tomorrow.", &["Will Smith"]),
    ("Will you send the report?", &[]),
    ("Grace Hopper wrote the first compiler.", &["Grace Hopper"]),
    ("Mark the checkbox before you submit.", &[]),
    ("Hope Springs Eternal is a film.", &[]),
    ("She works at Goldman Sachs in London.", &[]),
    ("Johnson & Johnson reported earnings.", &[]),
    ("Our office is on Washington Street.", &[]),
    ("He moved from San Francisco to Los Angeles.", &[]),
    ("Paris Hilton visited Paris.", &["Paris Hilton"]),
    ("JOHN SMITH SIGNED THE FORM", &["JOHN SMITH"]),
    (
        "Dr. Sarah O'Connor-Reyes will see you.",
        &["Sarah O'Connor-Reyes"],
    ),
    (
        "Signed: Martin Luther King Jr.",
        &["Martin Luther King Jr."],
    ),
    (
        "cc: Ana María García,\nBob Lee",
        &["Ana María García", "Bob Lee"],
    ),
    ("(contact: Priya Raghunathan)", &["Priya Raghunathan"]),
    ("Thanks,\nEmily\n", &["Emily"]),
    ("Customer Service Team", &[]),
    ("The Quick Brown Fox Jumps", &[]),
    ("Microsoft Teams meeting at Apple Park", &[]),
    ("Professor Plum in the library", &["Plum"]),
    ("Sent from my iPhone", &[]),
    ("Vincent van Gogh painted it.", &["Vincent van Gogh"]),
    ("Ask Jordan Taylor about Austin Texas.", &["Jordan Taylor"]),
];

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args
        .next()
        .expect("usage: person_name_eval <corpus.json> [--verbose]");
    let verbose = args.next().as_deref() == Some("--verbose");

    let source = std::fs::read_to_string(path).expect("readable corpus");
    let corpus: Corpus = serde_json::from_str(&source).expect("corpus JSON");
    let redactor = Redactor::new(&json!({ "rules": { "person_name": { "action": "redact" } } }))
        .expect("config");

    let spans = |text: &str| -> HashSet<(usize, usize)> {
        redactor
            .inspect(text)
            .expect("inspect")
            .groups
            .iter()
            .flat_map(|group| &group.matches)
            .map(|found| (found.detection.start, found.detection.end))
            .collect()
    };

    let mut official = Score::default();
    let mut true_names = Score::default();
    let mut negatives = Score::default();
    let mut negative_documents = 0;
    let mut bytes = 0;
    let started = Instant::now();

    for case in corpus.cases.iter().filter(|case| case.kind != "deferred") {
        let actual = spans(&case.text);
        let labels: Vec<&Tuple> = case
            .expected
            .iter()
            .filter(|tuple| tuple.rule_id == LABEL)
            .collect();
        let expected = to_bytes(&case.text, &labels);

        let is_generated = case.id.starts_with("name-pos-") || case.id.starts_with("mixed-");
        let names: HashSet<(usize, usize)> = expected
            .iter()
            .copied()
            .filter(|&(start, end)| is_generated && !case.text[start..end].contains('\n'))
            .collect();

        official.add(&expected, &actual);
        true_names.add(&names, &actual);

        if case.kind == "negative" {
            negatives.add(&expected, &actual);
            negative_documents += 1;
        }

        if verbose {
            for &(start, end) in actual.difference(&names) {
                println!("fp {} {:?}", case.id, &case.text[start..end]);
            }

            for &(start, end) in names.difference(&actual) {
                println!("fn {} {:?}", case.id, &case.text[start..end]);
            }
        }

        bytes += case.text.len();
    }

    let elapsed = started.elapsed().as_secs_f64();

    official.print("official");
    true_names.print("true_names");
    println!(
        "negatives: {negative_documents} documents, {} false positives",
        negatives.fp
    );

    let mut tricky = Score::default();

    for (input, names) in TRICKY {
        let actual = spans(input);
        let expected: HashSet<(usize, usize)> = names
            .iter()
            .map(|name| {
                let start = input.find(name).expect("tricky name in its input");

                (start, start + name.len())
            })
            .collect();

        let found: Vec<&str> = actual
            .iter()
            .map(|&(start, end)| &input[start..end])
            .collect();
        let mark = if actual == expected { "ok  " } else { "MISS" };
        println!("{mark} {input:?} -> {found:?}");

        tricky.add(&expected, &actual);
    }

    tricky.print("tricky");

    let mib = bytes as f64 / (1024.0 * 1024.0);
    println!(
        "throughput: {mib:.2} MiB in {:.1} ms (inspect, incl. engine)",
        elapsed * 1000.0
    );
}

/// The corpus's UTF-16 spans as byte spans.
fn to_bytes(text: &str, tuples: &[&Tuple]) -> HashSet<(usize, usize)> {
    tuples
        .iter()
        .map(|tuple| {
            let mut offsets = [tuple.start, tuple.end];
            utf16_to_utf8(text, &mut offsets).expect("corpus offsets on char boundaries");

            (offsets[0], offsets[1])
        })
        .collect()
}
