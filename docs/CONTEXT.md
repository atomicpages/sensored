# VitePress documentation site

Technical documentation website for the sensored library, built with VitePress
2.0 (alpha, `next` channel).

## Structure

```
docs/
  .vitepress/
    config.ts          Site config: nav, sidebar, theme, search, logo, favicon
    theme/
      SensoredPlayground.vue  Shared compact/full browser playground
      playground.ts          Pure playground state, config, masking, code generation
      playground-handoff.ts  One-use in-memory homepage-to-route state
      custom.css              Full-width playground page layout
  index.md             Home page (hero layout with logo and feature cards)
  playground.md        Full local redaction playground
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
- `internal/**` is excluded from VitePress source collection because that
  gitignored tree contains private working documents, not site content.
- The nav bar shows the logo only (`siteTitle: false`) with light/dark variants
  via `themeConfig.logo`.
- Favicon is served from `docs/public/favicon.svg` via a `head` link tag in the
  config (note: the `href` includes the `base` prefix `/sensored/`).
- Default VitePress theme with dark mode support.
- The homepage embeds `SensoredPlayground` in compact mode; `/playground`
  renders full controls. Both modes run entirely in the browser, cap input at
  50,000 UTF-16 code units, and never persist or transmit user text.
- Each built-in preset has matching sample input. Preset changes replace the
  sample until the user edits or clears the input; user-modified and handed-off
  input is preserved.
- `config.ts` aliases `@sensored-core` to `src/index.ts`. The component imports
  that alias dynamically near viewport entry, keeping the redactor out of the
  initial page chunk. The optional `compromise` NER dependency loads only after
  the full playground enables `person_name`.
- The full playground dynamically imports `@speed-highlight/core` only when
  its generated TypeScript panel opens. Reactive updates replace code through
  `textContent` before highlighting; do not switch this path to `v-html`
  because generated code can contain user input.
- Homepage state crosses to `/playground` through a one-use module variable.
  Never move playground input into URLs, local storage, session storage, logs,
  analytics, or network requests.

## Dependencies

- `vitepress` (dev dependency, `next` channel / `2.0.0-alpha.x`)
- `@speed-highlight/core` (dev dependency; lazy runtime TypeScript highlighting)
- No `vue` dependency needed — VitePress bundles it internally.
- `sensored` source is bundled directly through the Vite alias; `dist/` is not
  required for documentation builds.
