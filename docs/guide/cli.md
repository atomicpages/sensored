# CLI

sensored ships with a command-line interface for redacting, inspecting, and
restoring PII in text files and pipelines.

## Installation

The CLI is included with the `sensored` package:

```bash
bun add sensored
```

Run it via `bunx`:

```bash
bunx sensored --help
```

Or download a compiled binary from the
[GitHub Releases](https://github.com/atomicpages/sensored/releases) page for
standalone use without a runtime.

## Commands

### `sensored` (redact)

Redacts PII from stdin or a file. This is the default command — `sensored` and
`sensored redact` are equivalent.

**Pipe mode:**

```bash
echo "Contact john@example.com" | sensored --preset pii
# Contact [EMAIL]
```

**File mode:**

```bash
sensored input.txt output.txt --preset pii
```

**Flags:**

| Flag | Description |
| --- | --- |
| `--preset <name>` | Apply a preset rule set |
| `--rule <id>:<action>` | Override a single rule (can be repeated) |
| `--allowlist <value>` | Exclude a value from redaction (can be repeated) |
| `--allowlist-file <path>` | Load allowlist values from a file (one per line) |
| `--restore` | Enable restoration map generation |
| `--no-restore` | Disable restoration map (overrides config) |
| `--restore-map <path>` | Path for restoration map (required with `--restore` in pipe mode) |
| `--semantic` | Enable AI-powered semantic confirmation (requires `TYPESAFE_API_KEY`) |
| `--max-input-length <n>` | Maximum input length in characters |
| `--force` | Overwrite existing output files |
| `--json` | Output JSON with text, detections, and map |
| `--config <path>` | Path to config file |
| `--no-config` | Disable config auto-discovery |
| `--help` | Show help |
| `--version` | Show version |

**Rule actions:** `redact`, `mask`, `remove`, `format-preserve`,
`token-replace`, `off`.

**Example — multiple rules:**

```bash
echo "Email: john@example.com, SSN: 123-45-6789" | \
  sensored --rule email:mask --rule us_ssn:redact --no-config
# Email: j***@example.com, SSN: [SSN_1]
```

**Example — restoration:**

```bash
# Redact with restoration map
sensored input.txt output.txt --preset pii --restore
# Writes output.txt and output.map.json

# Restore
sensored restore output.txt --map output.map.json original.txt
```

**Example — JSON output:**

```bash
echo "Contact john@example.com" | sensored --preset pii --json
```

```json
{
  "text": "Contact [EMAIL]",
  "detections": [],
  "map": {}
}
```

### `sensored inspect`

Detects PII without redacting. Shows a table of detections by default.

```bash
echo "Contact john@example.com" | sensored inspect --preset pii
```

```
Rule ID             Entity Type         Value                                       Start     End       Replacement
-------------------- -------------------- ------------------------------------------  --------  --------  ---------------
email               email               john@example.com                            8         24        [EMAIL]

Total: 1 detection(s)
```

The "Total:" line is written to stderr so it doesn't interfere with piping
the table output.

Use `--json` for machine-readable output:

```bash
echo "Contact john@example.com" | sensored inspect --preset pii --json
```

### `sensored restore`

Restores redacted text using a restoration map.

```bash
# From files
sensored restore redacted.txt --map map.json restored.txt

# From stdin
echo "Contact [EMAIL_1]" | sensored restore --map map.json
# Contact john@example.com
```

**Flags:**

| Flag | Description |
| --- | --- |
| `--map <path>` | Path to restoration map JSON file (or provide as 2nd positional) |
| `--force` | Overwrite existing output files |

### `sensored list-detectors`

Lists all built-in detectors.

```bash
sensored list-detectors
```

Use `--json` for machine-readable output.

### `sensored list-presets`

Lists all built-in presets.

```bash
sensored list-presets
```

```
Preset           Rules
---------------  -------
pii              96
gdpr             39
hipaa            29
...
```

Use `--json` for machine-readable output.

## Configuration

The CLI auto-discovers config files by walking up from the current directory:

- `sensored.config.ts`
- `sensored.config.mts`
- `sensored.config.cts`
- `sensored.config.json`
- `sensored.config.jsonc`

Use `--config <path>` to specify a config file explicitly, or `--no-config` to
disable auto-discovery.

### Config file

```ts
import { defineConfig } from "sensored/config";

export default defineConfig({
  presets: ["pii"],
  rules: {
    email: { action: "mask" },
  },
  allowlist: ["admin@example.com"],
});
```

### Config merge

Config is the base, flags are patches:

- `--preset` unions with config presets
- `--rule` overrides individual rules from config
- `--allowlist` appends to config allowlist
- `--restore` / `--no-restore` / `--semantic` override config booleans

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Runtime error (file not found, invalid config, etc.) |
| 2 | Usage error (missing required args, no input) |
