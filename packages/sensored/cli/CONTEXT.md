# CLI

Command-line interface for the sensored PII redaction library. Built with
`citty` for command parsing, distributed via npm `bin` entry and compiled
binaries.

## Structure

```
cli/
  index.ts           Entry point: manual sub-command dispatch, flag extraction,
                     citty command definitions, main()
  config.ts          defineConfig() helper for sensored/config subpath export
  load-config.ts     Config auto-discovery + loading (findConfig, loadConfig,
                     resolveConfig)
  flags.ts           parseRuleFlag(), CLIOptions interface, mergeConfig(),
                     loadAllowlistFile()
  errors.ts          Exit codes (0/1/2), CLIError class, printError, printUsageError
  colors.ts          ANSI color helpers with TTY detection
  output.ts          formatTable, formatJSON, printTable, printJSON, printInfo
  shared.ts          buildRedactor(), readStdin(), I/O helpers (assertPipeOrFile,
                     readInputFile, assertWritable, writeOutput, writeRestoreMap)
  commands/
    redact.ts        Redact command (pipe + file mode, restore, semantic, JSON)
    inspect.ts       Inspect command (detection table/JSON output)
    restore.ts       Restore command (positional + --map flag)
    list-detectors.ts  List all built-in detectors
    list-presets.ts    List all built-in presets
  test/
    flags.test.ts    Unit tests for parseRuleFlag, mergeConfig
    output.test.ts   Unit tests for formatTable, formatJSON
    cli.test.ts      Integration tests spawning the CLI binary
```

## Architecture

### Entry point (index.ts)

Manual sub-command dispatch before citty takes over. This works around
citty limitations:

1. **Repeated flags** (`--rule`, `--allowlist`): citty has no native array flag
   support. `extractRepeated()` manually pulls these from `process.argv` before
   passing remaining args to citty.

2. **Boolean negation flags** (`--no-config`, `--no-restore`): citty interprets
   `--no-X` as negating `--X`. `extractBoolean()` manually pulls these before
   citty sees them.

3. **Bare `sensored <file>`**: citty treats the first positional as a sub-command
   name. Manual dispatch in `main()` checks if the first positional matches a
   known sub-command; if not, it routes to `redactCmd` (the default).

4. **Flag-value ambiguity**: `findFirstPositional()` uses a `VALUE_FLAGS` set to
   skip flag values that would otherwise be mistaken for subcommand names
   (e.g., `--allowlist redact input.txt`).

Manually-extracted values (`rules`, `allowlist`, `noConfig`, `noRestore`) are
passed to citty via `ctx.data` and forwarded to command handlers as `CLIOptions`.

### Flag plumbing

A single `CLIOptions` interface (defined in `flags.ts`) flows from arg
extraction through `buildRedactor()` to command handlers. This replaces the
previous 4 overlapping interfaces (`BuildRedactorArgs`, `CLIFlags`,
`RedactArgs`, `InspectArgs`).

### Error handling

`printError` and `printUsageError` throw `CLIError` exceptions instead of
calling `process.exit()` directly. The `main()` catch block in `index.ts`
handles `CLIError` by printing the message and exiting with the appropriate
code. This makes command functions unit-testable without spawning a binary.

### Sub-commands

- `sensored` (bare) or `sensored redact` — Redact text (pipe or file)
- `sensored inspect` — Show detections without redacting
- `sensored restore` — Restore redacted text using a restoration map
- `sensored list-detectors` — List all built-in detectors
- `sensored list-presets` — List all built-in presets

### I/O model

Shared I/O helpers in `shared.ts` handle common patterns across commands:

- **`assertPipeOrFile()`**: TTY check — errors if stdin is a terminal with no
  input file.
- **`readInputFile()`**: Reads a file, errors on failure.
- **`assertWritable()`**: Checks if output file exists, requires `--force`.
- **`writeOutput()`**: Writes to file or stdout depending on path.
- **`writeRestoreMap()`**: Writes restoration map JSON to a file.

- **Pipe mode** (no input file): reads stdin, writes stdout. Streaming via
  `redactor.stream()` for redact without `--json` or `--restore`.
- **File mode** (input file positional): reads file, writes to output file or
  stdout. Checks input length limit, refuses to overwrite existing output
  without `--force`.

### Config

Auto-discovers `sensored.config.{ts,mts,cts,json,jsonc}` upward from cwd.
`--config <path>` overrides discovery. `--no-config` disables auto-discovery.
TS config files loaded via dynamic `import()`. The `defineConfig` helper is
exported from `sensored/config` subpath.

Config merge: config is base, flags are patches. `--preset` unions,
`--rule` overrides per-rule, `--allowlist` appends, `--restore`/`--no-restore`
and `--semantic` boolean overrides. `mergeConfig()` is a pure function — it
does not read `process.env`; the API key is passed in by `buildRedactor()`.

### Rule syntax

`--rule <id>:<action>` where action is one of:
`redact`, `mask`, `remove`, `format-preserve`, `token-replace`, `off`.

### Restoration

`--restore` enables map generation. `--no-restore` disables it (overrides
config). File mode writes sidecar `<base>.map.json`. Pipe mode requires
`--restore-map <path>`.

### Semantic

`--semantic` uses `redactAsync()`, reads `TYPESAFE_API_KEY` from env in
`buildRedactor()`.

### Output

- `--json` on redact: `{ text, detections, map }` JSON object
- `inspect`/`list-*`: table by default, `--json` for JSON arrays

### Exit codes

- 0: success
- 1: runtime error (file not found, invalid config, etc.)
- 2: usage error (missing required args, TTY with no input, etc.)

Errors print to stderr as `sensored: <message>` with optional hint.

## Build

`tsdown.config.ts` includes three entry points: `src/index.ts` (library),
`cli/index.ts` (CLI binary), `cli/config.ts` (config subpath). The CLI entry
gets execute permission in the build output.

## Distribution

- npm: `bunx sensored` via `bin` entry in package.json
- Compiled binaries: `bun build --compile` in CI for linux-x64, linux-arm64,
  darwin-arm64, attached to GitHub Releases
