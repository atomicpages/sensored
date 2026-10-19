mod support;

#[test]
fn stub_registry_has_every_ts_detector() {
    assert_eq!(support::stub_registry().len(), 155);
}

#[test]
fn golden_files_load() {
    assert!(!support::golden::<support::RenderCase>("render.json").is_empty());
    assert!(!support::golden::<support::RenderCase>("offsets.json").is_empty());
    assert!(!support::golden::<support::RenderCase>("presets.json").is_empty());
    assert!(!support::golden::<support::PolicyCase>("policy.json").is_empty());
    assert!(!support::golden::<support::ErrorCase>("errors.json").is_empty());
    assert!(!support::golden::<support::StreamCase>("stream.json").is_empty());
    assert!(!support::golden::<support::RestoreCase>("restore.json").is_empty());
}

#[test]
fn fixture_offsets_convert_to_bytes() {
    assert_eq!(support::to_bytes("é😀x", &[3, 0, 1]), [6, 0, 2]);
}
