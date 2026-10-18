fn main() {
    let text = std::fs::read_to_string(std::env::args().nth(1).unwrap()).unwrap();
    let secs: u64 = std::env::args().nth(2).unwrap().parse().unwrap();
    let r = sensored_core::Redactor::new(&serde_json::json!({ "presets": ["pii"], "rules": {} }))
        .unwrap();
    let end = std::time::Instant::now() + std::time::Duration::from_secs(secs);
    while std::time::Instant::now() < end {
        std::hint::black_box(r.redact(&text).unwrap());
    }
}
