#!/bin/bash
set -euo pipefail

if grep -rl 'node:' dist/src/; then
  echo "ERROR: Found node: imports in dist/src/ — core library is not browser/edge compatible"
  grep -rl 'node:' dist/src/
  exit 1
fi

echo "No node: imports found in dist/src/ — browser/edge compatible"
