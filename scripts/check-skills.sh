#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

node -e 'JSON.parse(require("fs").readFileSync("package.json"));'
test -f dist/sdd-agentic-flow.js
test -f bin/sdd-agentic-flow.js
npx tsx scripts/check-skill-contracts.ts
npx tsx scripts/check-discovery-boundary.ts
npx tsx scripts/check-version-consistency.ts
# Shared reference presence and citation are enforced by check-skill-contracts.ts.
for template in context spec design tasks task-prompt check-report validation-report pr-description pr-review pr-fix domain-glossary discovery; do
  test -f "shared/templates/$template.template.md"
done
bash ./scripts/sanitize-private-context.sh
echo "PASS skills, contracts, safety, and package checks"
