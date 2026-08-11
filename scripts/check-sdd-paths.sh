#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v rg >/dev/null 2>&1; then
  echo "check-sdd-paths: ripgrep (rg) is required" >&2
  exit 1
fi

# Legacy `.sdd/` is allowed only where migration narrative requires it (see docs/upgrading.md).
matches="$(rg '\.sdd/' \
  --glob '!node_modules/**' \
  --glob '!.local/**' \
  --glob '!CHANGELOG.md' \
  --glob '!scripts/check-sdd-paths.sh' \
  --glob '!bin/sdd-agentic-flow.js' \
  --glob '!test/cli.test.js' \
  --glob '!.gitignore' \
  --glob '!docs/upgrading.md' \
  --glob '!docs/sdd-agentic-flow-model.md' \
  --glob '!examples/golden/sdd-path-migrate/**' \
  --glob '!README.md' \
  --glob '!README.pt-BR.md' \
  --glob '!ROADMAP.md' \
  || true)"

if [[ -n "$matches" ]]; then
  echo "check-sdd-paths: legacy .sdd/ path references found (expected .sdd-agentic-flow/):" >&2
  echo "$matches" >&2
  exit 1
fi

echo "check-sdd-paths: ok"
