# VitePress documentation site

Technical documentation website for the sensored library, built with VitePress
2.0 (alpha, `next` channel).

## Structure

```
docs/
  .vitepress/
    config.ts          Site config: nav, sidebar, theme, search, logo, favicon
  index.md             Home page (hero layout with logo and feature cards)
  public/              Static assets served as-is by VitePress
    favicon.svg        Favicon (terminal mark icon)
    logo-light.svg     Horizontal logo for light mode (nav + hero)
    logo-dark.svg      Horizontal logo for dark mode (nav + hero)
    social-preview.svg 1280×640 social preview image
  guide/               Human-facing guides (install, quick start, presets, etc.)
  detectors/           Per-domain detector reference pages
  api/                 API reference (types, functions, constants)
  about/               Changelog
```

Brand assets also live at the repo root in `assets/` — see `assets/README.md`
for the full catalog (horizontal, wordmark, icon, and social variants in
light/dark/mono).

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
- The nav bar shows the logo only (`siteTitle: false`) with light/dark variants
  via `themeConfig.logo`.
- Favicon is served from `docs/public/favicon.svg` via a `head` link tag in the
  config (note: the `href` includes the `base` prefix `/sensored/`).
- Default VitePress theme with dark mode support.

## Dependencies

- `vitepress` (dev dependency, `next` channel / `2.0.0-alpha.x`)
- No `vue` dependency needed — VitePress bundles it internally.
