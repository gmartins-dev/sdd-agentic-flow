#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

# Legacy `.sdd/` is allowed only where breaking-notes or historical record require it
# (see docs/v2-breaking-changes.md). Uses git grep (available in CI) instead of ripgrep.
matches="$(git grep -n --fixed-strings '.sdd/' -- \
  ':(exclude)CHANGELOG.md' \
  ':(exclude)scripts/check-sdd-paths.sh' \
  ':(exclude)dist/sdd-agentic-flow.js' \
  ':(exclude)src/sdd-agentic-flow.ts' \
  ':(exclude)src/paths.ts' \
  ':(exclude)test/cli.test.ts' \
  ':(exclude).gitignore' \
  ':(exclude)docs/v2-breaking-changes.md' \
  ':(exclude)docs/sdd-agentic-flow-model.md' \
  ':(exclude)README.md' \
  ':(exclude)README.pt-BR.md' \
  ':(exclude)ROADMAP.md' \
  ':(exclude)docs/uninstall.md' \
  || true)"

if [[ -n "$matches" ]]; then
  echo "check-sdd-paths: legacy .sdd/ path references found (expected .sdd-agentic-flow/):" >&2
  echo "$matches" >&2
  exit 1
fi

echo "check-sdd-paths: ok"
