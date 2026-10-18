//! Times each built-in detector on a text file, slowest first.
//!
//! `cargo run --release --example detector_profile -- <file>`

use std::time::Instant;

use sensored_core::detectors::builtins;

const RUNS: u32 = 5;

fn main() {
    let path = std::env::args()
        .nth(1)
        .expect("usage: detector_profile <file>");
    let text = std::fs::read_to_string(path).expect("readable UTF-8 file");

    let mut rows: Vec<(String, f64, usize)> = builtins()
        .iter()
        .map(|detector| {
            let mut out = Vec::new();
            detector.detect(&text, &mut out);
            let found = out.len();

            let start = Instant::now();

            for _ in 0..RUNS {
                out.clear();
                detector.detect(&text, &mut out);
            }

            let ms = start.elapsed().as_secs_f64() * 1000.0 / f64::from(RUNS);

            (detector.id().to_owned(), ms, found)
        })
        .collect();

    rows.sort_by(|a, b| b.1.total_cmp(&a.1));

    let total: f64 = rows.iter().map(|row| row.1).sum();

    for (id, ms, found) in &rows {
        println!("{id:<24} {ms:>9.2} ms  {found:>6} matches");
    }

    println!("total {total:.2} ms");
}
