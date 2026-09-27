# VitePress documentation site

Technical documentation website for the sensored library, built with VitePress
2.0 (alpha, `next` channel).

## Structure

```
docs/
  .vitepress/
    config.ts          Site config: nav, sidebar, theme, search
  index.md             Home page (hero layout with feature cards)
  guide/               Human-facing guides (install, quick start, presets, etc.)
  detectors/           Per-domain detector reference pages
  api/                 API reference (types, functions, constants)
  about/               Changelog
```

## Commands

- `bun run docs:dev` — Start dev server with hot reload
- `bun run docs:build` — Build static site to `docs/.vitepress/dist/`
- `bun run docs:preview` — Preview the built site locally

## Content guidelines

- All pages are written for human developers using the library, not for AI
  agents. Do not copy content from CONTEXT.md files in the source tree — those
  are internal AI-facing documentation.
- Code examples should be self-contained and runnable.
- Detector pages follow a consistent format: description, code example, and a
  metadata table (ID, entity type, context, stream, validation).
- The VitePress config uses `cleanUrls: true` and `lastUpdated: true`.
- No custom theme — default VitePress theme with dark mode support.

## Dependencies

- `vitepress` (dev dependency, `next` channel / `2.0.0-alpha.x`)
- No `vue` dependency needed — VitePress bundles it internally.
