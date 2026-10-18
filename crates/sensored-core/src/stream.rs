//! The synchronous stream core. Mirrors `createStreamCore` in `stream.ts`.
//!
//! Flush math, the buffer limit and context trimming are in UTF-16 units, as
//! in TS. Reported offsets use the caller's `OffsetUnit`: a binding cannot
//! convert absolute stream offsets afterwards, because the text is gone.

use std::collections::HashSet;

use crate::engine::{RenderOptions, Segment, detect_matches, is_valid_span, render_detected};
use crate::errors::{ErrorCode, Result, SensoredError};
use crate::grapheme;
use crate::text::{utf8_to_utf16, utf16_len};
use crate::types::{
    ActiveRule, AppliedMatch, Detection, InspectionGroup, RestorationContext, RestorationMap,
};

/// Streaming buffer limit, in UTF-16 code units.
pub const BUFFER_LIMIT: usize = 65_536;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OffsetUnit {
    /// UTF-8 bytes, as everywhere else in the core.
    #[default]
    Utf8,
    /// UTF-16 code units, as the JS API reports.
    Utf16,
}

#[derive(Debug, Clone, Default)]
pub struct StreamOptions {
    pub report: bool,
    pub restore: bool,
    pub detect_only: bool,
    pub allowlist: HashSet<String>,
    pub offsets: OffsetUnit,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamEvent {
    Text(String),
    /// A replacement group with absolute offsets in the stream.
    Detection(InspectionGroup),
    /// Always last; carries the map when restoration is enabled.
    Complete(Option<RestorationMap>),
}

pub struct StreamCore {
    rules: Vec<ActiveRule>,
    options: StreamOptions,
    restoration: Option<RestorationContext>,
    /// Largest `maxMatchLength + max(left, right) + boundaryLookaround`.
    holdback: usize,
    /// Largest left context: how much emitted text must stay buffered.
    max_left_context: usize,
    buffer: String,
    buffer_units: usize,
    /// Byte offset in `buffer` up to which output was emitted.
    consumed: usize,
    /// Position of `buffer[0]` in the whole stream.
    absolute_bytes: usize,
    absolute_units: usize,
}

impl StreamCore {
    /// Fails with `STREAM_UNSUPPORTED` when a rule has no stream metadata.
    pub fn new(rules: Vec<ActiveRule>, options: StreamOptions) -> Result<Self> {
        let mut holdback = 0;
        let mut max_left_context = 0;

        for rule in &rules {
            let Some(meta) = rule.detector.stream() else {
                return Err(SensoredError::new(ErrorCode::StreamUnsupported));
            };

            holdback = holdback.max(
                meta.max_match_length
                    + meta.left_context.max(meta.right_context)
                    + meta.boundary_lookaround,
            );
            max_left_context = max_left_context.max(meta.left_context);
        }

        let restoration =
            (options.restore && !options.detect_only).then(|| RestorationContext::new(false));

        Ok(Self {
            rules,
            options,
            restoration,
            holdback,
            max_left_context,
            buffer: String::new(),
            buffer_units: 0,
            consumed: 0,
            absolute_bytes: 0,
            absolute_units: 0,
        })
    }

    pub fn push(&mut self, chunk: &str) -> Result<Vec<StreamEvent>> {
        self.push_with(chunk, no_extra)
    }

    /// `push` for callers with their own detectors (the hybrid seam).
    /// `extra` gets the buffer whenever something may flush and returns the
    /// caller's detections in it (byte offsets); they render with the core's.
    /// A rule id outside the stream's rules, an empty span or a span off char
    /// boundaries is a `DETECTOR_CONTRACT` error.
    pub fn push_with(
        &mut self,
        chunk: &str,
        extra: impl FnOnce(&str) -> Result<Vec<Detection>>,
    ) -> Result<Vec<StreamEvent>> {
        self.buffer.push_str(chunk);
        self.buffer_units += utf16_len(chunk);

        if self.buffer_units > BUFFER_LIMIT {
            return Err(SensoredError::new(ErrorCode::BufferLimit));
        }

        let mut events = Vec::new();

        let Some(flush_point) = self.flush_point() else {
            return Ok(events);
        };

        let consumed = self.render(flush_point, extra, &mut events)?;

        if consumed <= self.consumed {
            return Ok(events);
        }

        self.consumed = consumed;
        self.trim();

        Ok(events)
    }

    pub fn finish(self) -> Vec<StreamEvent> {
        self.finish_with(no_extra)
            .expect("core detections always satisfy the contract")
    }

    /// `finish` with the caller's detections; see `push_with`.
    pub fn finish_with(
        mut self,
        extra: impl FnOnce(&str) -> Result<Vec<Detection>>,
    ) -> Result<Vec<StreamEvent>> {
        let mut events = Vec::new();

        if !self.buffer.is_empty() {
            self.render(self.buffer.len(), extra, &mut events)?;
        }

        events.push(StreamEvent::Complete(
            self.restoration.map(|context| context.map),
        ));

        Ok(events)
    }

    /// The safe flush byte offset, or `None` when nothing may flush yet.
    /// Mirrors `calculateFlushPoint` plus `adjustForGrapheme`.
    fn flush_point(&self) -> Option<usize> {
        let units = self.buffer_units.checked_sub(self.holdback)?;
        let mut byte = byte_at_unit(&self.buffer, units);

        while byte > 0 && !grapheme::is_boundary(&self.buffer, byte) {
            byte = self.buffer[..byte]
                .char_indices()
                .next_back()
                .map_or(0, |(i, _)| i);
        }

        (byte > 0).then_some(byte)
    }

    /// Renders up to `flush_point`, appends events, returns bytes consumed.
    fn render(
        &mut self,
        flush_point: usize,
        extra: impl FnOnce(&str) -> Result<Vec<Detection>>,
        events: &mut Vec<StreamEvent>,
    ) -> Result<usize> {
        let mut detected = detect_matches(&self.buffer, &self.rules);

        for detection in extra(&self.buffer)? {
            let rule = self
                .rules
                .iter()
                .find(|rule| rule.detector.id() == detection.rule_id)
                .filter(|_| is_valid_span(&self.buffer, &detection))
                .ok_or_else(|| SensoredError::new(ErrorCode::DetectorContract))?;

            detected.push(AppliedMatch { detection, rule });
        }

        let options = RenderOptions {
            report: self.options.report,
            detect_only: self.options.detect_only,
            allowlist: &self.options.allowlist,
        };

        let rendered = render_detected(
            &self.buffer,
            detected,
            flush_point,
            self.consumed,
            self.restoration.as_mut(),
            options,
        );

        if rendered.consumed > self.consumed {
            for segment in rendered.segments {
                self.emit(segment, events);
            }
        }

        Ok(rendered.consumed)
    }

    fn emit(&self, segment: Segment<'_>, events: &mut Vec<StreamEvent>) {
        let Some(group) = segment.group else {
            events.push(StreamEvent::Text(segment.text.into_owned()));
            return;
        };

        if self.options.detect_only {
            events.push(StreamEvent::Text(segment.text.into_owned()));
        }

        events.push(StreamEvent::Detection(self.to_absolute(group)));
    }

    fn to_absolute(&self, mut group: InspectionGroup) -> InspectionGroup {
        let (base, convert) = match self.options.offsets {
            OffsetUnit::Utf8 => (self.absolute_bytes, false),
            OffsetUnit::Utf16 => (self.absolute_units, true),
        };

        if convert {
            let mut offsets: Vec<usize> = std::iter::once(group.start)
                .chain(std::iter::once(group.end))
                .chain(
                    group
                        .matches
                        .iter()
                        .flat_map(|m| [m.detection.start, m.detection.end]),
                )
                .collect();

            let mut order: Vec<usize> = (0..offsets.len()).collect();
            order.sort_by_key(|&i| offsets[i]);

            let mut sorted: Vec<usize> = order.iter().map(|&i| offsets[i]).collect();
            utf8_to_utf16(&self.buffer, &mut sorted);

            for (slot, &i) in order.iter().enumerate() {
                offsets[i] = sorted[slot];
            }

            group.start = offsets[0];
            group.end = offsets[1];

            for (m, pair) in group.matches.iter_mut().zip(offsets[2..].chunks(2)) {
                m.detection.start = pair[0];
                m.detection.end = pair[1];
            }
        }

        group.start += base;
        group.end += base;

        for m in &mut group.matches {
            m.detection.start += base;
            m.detection.end += base;
        }

        group
    }

    /// Drops emitted text beyond the largest left context. Mirrors the trim
    /// in TS; a cut inside a surrogate pair keeps the whole character.
    fn trim(&mut self) {
        let consumed_units = utf16_len(&self.buffer[..self.consumed]);

        let Some(trim_units) = consumed_units.checked_sub(self.max_left_context) else {
            return;
        };

        if trim_units == 0 {
            return;
        }

        let trim = byte_at_unit(&self.buffer, trim_units);
        let trimmed_units = utf16_len(&self.buffer[..trim]);

        self.buffer.drain(..trim);
        self.buffer_units -= trimmed_units;
        self.consumed -= trim;
        self.absolute_bytes += trim;
        self.absolute_units += trimmed_units;
    }
}

fn no_extra(_: &str) -> Result<Vec<Detection>> {
    Ok(Vec::new())
}

/// Byte offset of UTF-16 position `units`; inside a surrogate pair, the
/// start of that character.
fn byte_at_unit(text: &str, units: usize) -> usize {
    let mut seen = 0;

    for (byte, ch) in text.char_indices() {
        if seen + ch.len_utf16() > units {
            return byte;
        }

        seen += ch.len_utf16();
    }

    text.len()
}
