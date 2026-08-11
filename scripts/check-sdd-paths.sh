#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

# Legacy `.sdd/` is allowed only where migration narrative requires it (see docs/upgrading.md).
# Uses git grep (available in CI) instead of ripgrep.
matches="$(git grep -n --fixed-strings '.sdd/' -- \
  ':(exclude)CHANGELOG.md' \
  ':(exclude)scripts/check-sdd-paths.sh' \
  ':(exclude)bin/sdd-agentic-flow.js' \
  ':(exclude)test/cli.test.js' \
  ':(exclude).gitignore' \
  ':(exclude)docs/upgrading.md' \
  ':(exclude)docs/sdd-agentic-flow-model.md' \
  ':(exclude)examples/golden/sdd-path-migrate/walkthrough.md' \
  ':(exclude)README.md' \
  ':(exclude)README.pt-BR.md' \
  ':(exclude)ROADMAP.md' \
  || true)"

if [[ -n "$matches" ]]; then
  echo "check-sdd-paths: legacy .sdd/ path references found (expected .sdd-agentic-flow/):" >&2
  echo "$matches" >&2
  exit 1
fi

echo "check-sdd-paths: ok"
