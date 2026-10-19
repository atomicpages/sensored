//! External detector descriptors: the JSON-able part of a caller's
//! `DetectorDefinition`. Mirrors `validateDefinition` and the metadata half
//! of `RegexDetector`.
//!
//! The TS wrapper strips `pattern`, `validate` and `semanticConfirm` and
//! checks them itself, so here they are unknown keys.

use serde_json::{Map, Value};

use super::json::{has_only_keys, invalid, is_identifier, non_empty_str, non_negative_integer};
use crate::detector::{ContextHint, ExternalDetector, HintPosition, HintWindow, StreamMeta};
use crate::errors::Result;

const DESCRIPTOR_KEYS: &[&str] = &[
    "id",
    "entityType",
    "replacement",
    "context",
    "stream",
    "contextHint",
];

const STREAM_KEYS: &[&str] = &[
    "maxMatchLength",
    "leftContext",
    "rightContext",
    "boundaryLookaround",
];

const CONTEXT_HINT_KEYS: &[&str] = &["labels", "position", "instructions"];

/// `context`: the window, in UTF-16 units, a detector inspects around a match.
#[derive(Default, Clone, Copy)]
struct Window {
    before: usize,
    after: usize,
}

pub(super) fn parse_descriptor(value: &Value) -> Result<ExternalDetector> {
    let descriptor = value.as_object().ok_or_else(|| invalid("detectors"))?;

    let id = descriptor
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| is_identifier(id, false))
        .ok_or_else(|| invalid("detectors"))?;

    let entity_type = descriptor
        .get("entityType")
        .and_then(non_empty_str)
        .ok_or_else(|| invalid("detectors"))?;

    let replacement = descriptor
        .get("replacement")
        .and_then(Value::as_str)
        .ok_or_else(|| invalid("detectors"))?;

    if !has_only_keys(descriptor, DESCRIPTOR_KEYS) {
        return Err(invalid("detectors"));
    }

    let context = descriptor.get("context").map(parse_context).transpose()?;
    let stream = descriptor
        .get("stream")
        .map(|stream| parse_stream(stream, context))
        .transpose()?;
    let context_hint = descriptor
        .get("contextHint")
        .map(|hint| parse_context_hint(hint, context.unwrap_or_default()))
        .transpose()?;

    Ok(ExternalDetector {
        id: id.to_owned(),
        entity_type: entity_type.into(),
        replacement: replacement.to_owned(),
        stream,
        context_hint,
    })
}

/// `object[key]` as a non-negative integer that fits `usize`.
fn count(object: &Map<String, Value>, key: &str) -> Option<usize> {
    object
        .get(key)
        .and_then(non_negative_integer)
        .and_then(|n| usize::try_from(n).ok())
}

fn parse_context(value: &Value) -> Result<Window> {
    let path = "detectors.context";
    let context = value.as_object().ok_or_else(|| invalid(path))?;

    if !has_only_keys(context, &["before", "after"]) {
        return Err(invalid(path));
    }

    let before = count(context, "before").ok_or_else(|| invalid(path))?;
    let after = count(context, "after").ok_or_else(|| invalid(path))?;

    Ok(Window { before, after })
}

/// Mirrors `validateStream`: all four fields, a non-zero max match length,
/// and room for the context window.
fn parse_stream(value: &Value, context: Option<Window>) -> Result<StreamMeta> {
    let path = "detectors.stream";
    let stream = value.as_object().ok_or_else(|| invalid(path))?;

    if !has_only_keys(stream, STREAM_KEYS) {
        return Err(invalid(path));
    }

    let field = |key: &str| count(stream, key).ok_or_else(|| invalid(path));

    let meta = StreamMeta {
        max_match_length: field("maxMatchLength")?,
        left_context: field("leftContext")?,
        right_context: field("rightContext")?,
        boundary_lookaround: field("boundaryLookaround")?,
    };

    if meta.max_match_length == 0 {
        return Err(invalid(path));
    }

    if let Some(context) = context {
        if context.before > meta.left_context || context.after > meta.right_context {
            return Err(invalid(path));
        }
    }

    Ok(meta)
}

/// Mirrors `validateContextHint` and the hint `RegexDetector` builds: always
/// required, labels default to none, position to `both`, window to `context`.
fn parse_context_hint(value: &Value, window: Window) -> Result<ContextHint> {
    let path = "detectors.contextHint";
    let hint = value.as_object().ok_or_else(|| invalid(path))?;

    if !has_only_keys(hint, CONTEXT_HINT_KEYS) {
        return Err(invalid(path));
    }

    let labels = match hint.get("labels") {
        None => Vec::new(),
        Some(labels) => parse_labels(labels).ok_or_else(|| invalid(path))?,
    };

    let position = match hint.get("position").map(|p| p.as_str()) {
        None => HintPosition::Both,
        Some(Some("preceding")) => HintPosition::Preceding,
        Some(Some("following")) => HintPosition::Following,
        Some(Some("both")) => HintPosition::Both,
        Some(_) => return Err(invalid(path)),
    };

    let instructions = match hint.get("instructions") {
        None => None,
        Some(instructions) => Some(
            instructions
                .as_str()
                .ok_or_else(|| invalid(path))?
                .to_owned(),
        ),
    };

    Ok(ContextHint {
        required: true,
        labels,
        position,
        window: HintWindow {
            before: window.before,
            after: window.after,
        },
        instructions,
    })
}

/// A non-empty list of non-empty strings.
fn parse_labels(value: &Value) -> Option<Vec<String>> {
    let labels: Vec<String> = value
        .as_array()?
        .iter()
        .map(|label| non_empty_str(label).map(str::to_owned))
        .collect::<Option<_>>()?;

    (!labels.is_empty()).then_some(labels)
}
