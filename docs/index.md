---
layout: home

hero:
  name: sensored
  text: Streaming-first PII redaction for TypeScript
  tagline:
    Detect and redact sensitive data with 155 built-in detectors, AI-powered
    semantic confirmation, and full streaming support.
  image:
    src: /logo-light.svg
    alt: sensored
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/atomicpages/sensored

features:
  - title: Streaming-first
    details:
      Process continuous text streams with boundary buffering, context windows,
      and safe flush points. No need to buffer entire inputs in memory.
  - title: 155 Built-in Detectors
    details:
      Email, phone, payment cards, national IDs, passports, person names, cloud
      keys, JWT tokens, private keys, healthcare identifiers, HR data, legal
      references, crypto addresses, tracking numbers, and more across 13
      domains.
  - title: Rust Engine
    details:
      A Rust core runs natively on 7 platforms and as Wasm everywhere else,
      3.7-21x faster than v1 with all detectors on. The API stays synchronous
      and identical.
  - title: Reversible Redaction
    details:
      Enable restoration mode to get numbered placeholders and a restoration
      map. Reverse redaction back to original text with a single call.
  - title: 5 Transformation Actions
    details:
      Redact to type labels, mask with configurable preservation, remove
      entirely, format-preserve structure, or token-replace with deterministic
      fakes.
  - title: 11 Presets
    details:
      Start with pii, gdpr, hipaa, ccpa, pci-dss, healthcare, finance,
      education, soc2, or security. Combine and override with explicit rules.
  - title: Idempotent
    details:
      Re-redacting already-redacted text is a no-op. Placeholder filtering
      ensures safe pipeline chaining without double-processing.
  - title: Unicode-aware
    details:
      Grapheme cluster boundary enforcement and UTF-16 offset reporting. Handles
      emoji, combining marks, and multi-codepoint characters correctly.
  - title: AI Confirmation
    details:
      Opt-in Jev (TypeSafe System One) integration confirms detected PII
      candidates before redacting. Eliminates false positives without
      sacrificing recall. 100% precision in independent evaluation.
---

<SensoredPlayground mode="compact" />
